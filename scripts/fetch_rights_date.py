"""Collect rights-cutoff candidates for human review. See docs/data-sources.md."""
import argparse
import base64
import csv
from datetime import date
import hashlib
import json
from pathlib import Path
import re
import tempfile
from urllib.parse import urlencode, urljoin, urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "moatown-data"
CSV = ROOT / "data/rights_base_date_draft.csv"
DATE = r"(20\d{2})\s*(?:[.\-/]|년)\s*(\d{1,2})\s*(?:[.\-/]|월)\s*(\d{1,2})(?!\d)"
KEYWORD = re.compile(r"(?:분양\s*받을\s*)?권리\s*(?:의\s*)?산정\s*기준일|권리\s*산정\s*기준\s*일")
NUMBER = re.compile(r"제\s*(20\d\d\s*-\s*\d+)\s*호")
COLUMNS = ["id", "district", "name", "candidate_date", "notice_no", "source_as_of", "source_url",
           "scope", "evidence", "excerpt", "review"]


def read(path):
    return json.loads(path.read_bytes())


def write(path, data):
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(data, ensure_ascii=False, indent=2)+"\n", encoding="utf8", newline="\n")
    temp.replace(path)


def official(url):
    parsed = urlsplit(url)
    return parsed.scheme == "https" and (parsed.hostname or "").endswith(".go.kr")


def download(url):
    if not official(url):
        raise ValueError("공식 기관 주소가 필요합니다: "+url)
    with urlopen(Request(url, headers={"User-Agent":"Mozilla/5.0"}), timeout=45) as r:
        if not official(r.url):
            raise ValueError("공식 기관 외부로 이동: "+r.url)
        return r.read()


def catalogue(first, last):
    from bs4 import BeautifulSoup
    issues = {}
    for year in range(first, last+1):
        params = dict(schStDt=f"{year}-01-01", schEdDt=f"{year}-12-31",
                      schTxtType="G002", schTxt="분양받을 권리", pageCnt=100)
        doc = BeautifulSoup(download("https://www.seoul.go.kr/func/seoulsibo/list.do?"+urlencode(params)), "html.parser")
        for a in doc.select('tr a[href*="goView"]'):
            issue = re.search(r"'(\d+)'", a["href"])
            day = re.search(r"\d{4}\.\d{2}\.\d{2}", a.find_parent("tr").get_text())
            if issue and day:
                issues[issue[1]] = day[0].replace(".", "-")
    for issue, issued in issues.items():
        detail = "https://event.seoul.go.kr/seoulsibo/detailview.do?"+urlencode(
            {"cn_seq":base64.b64encode(issue.encode()).decode()})
        doc = BeautifulSoup(download(detail), "html.parser")
        links = [(a.get_text(" ", strip=True), urljoin(detail,a["href"]).split("#")[0], int(a["href"].split("#page=")[1]))
                 for a in doc.select('p.tit3 a[href*=".pdf#page="]')]
        for i,(title,url,start) in enumerate(links):
            no = NUMBER.search(title)
            if no and KEYWORD.search(title):
                end = next((page for _,_,page in links[i+1:] if page>start), start+12)
                yield dict(note=no[1], start=start, end=end, url=url, date=issued)


def town_tokens(town):
    values = []
    for source in (town["name"], town.get("address") or ""):
        for dong, lot in re.findall(r"([가-힣]+(?:\d+)?동)\s*(\d+(?:-\d+)?)", source):
            values.append(re.compile(re.escape(dong)+r"\s*"+re.escape(lot)+r"(?![\d-])"))
    return values


def parse(text, town, tokens, url, issued, number):
    for match in KEYWORD.finditer(text):
        segment = text[match.end():match.end()+100]
        found = re.match(r"[\s:：()·-]*(?:은|는|을|를)?\s*"+DATE, segment)
        if not found:
            continue
        region = text[max(0, match.start()-350):match.end()+350]
        if not any(token.search(region) for token in tokens):
            continue
        try:
            day = date(*map(int,found.groups())).isoformat()
        except ValueError:
            continue
        if not number:
            numbers = set(NUMBER.findall(text))
            if len(numbers)!=1:
                continue
            number = "제"+next(iter(numbers))+"호"
        yield dict(id=town["id"], district=town["district"], name=town["name"], candidate_date=day,
                   notice_no=number, source_as_of=issued, source_url=url, scope="검토 필요",
                   evidence="원문 텍스트 후보", excerpt=" ".join(region.split()), review="")


def candidates(towns, args):
    from bs4 import BeautifulSoup
    import pymupdf
    tokens = {t["id"]:town_tokens(t) for t in towns}
    for t in towns:
        for h in t.get("rights_cutoff_history", []):
            e = h.get("evidence") or {}
            if h.get("date") and e.get("source_url"):
                yield dict(id=t["id"], district=t["district"], name=t["name"], candidate_date=h["date"],
                           notice_no=e.get("notice_number"), source_as_of=e.get("source_as_of"), source_url=e["source_url"],
                           scope=h.get("scope"), evidence=h.get("status"), excerpt=h.get("condition"), review="")
    args.cache.mkdir(parents=True, exist_ok=True)
    entries = []
    if args.catalog:
        entries = read(args.catalog)
    elif args.crawl or not (args.url or args.history_only):
        entries = list(catalogue(args.start_year, args.end_year))
    entries += [dict(url=url,note="",date="",start=1,end=None) for url in args.url]
    for e in entries:
        url, no, start = e["url"],e["note"],e["start"]
        name = "서울특별시 고시 제"+no+"호" if no else ""
        saved = args.text_dir / (no+".txt") if args.text_dir and no else None
        if saved and saved.is_file():
            pages = [(int(n), txt) for n,txt in re.findall(r"\[\[PDF p\.(\d+)\]\](.*?)(?=\[\[PDF p\.|\Z)",
                                                          saved.read_text(encoding="utf8"),re.S)]
        else:
            path = args.cache / hashlib.sha256(url.encode()).hexdigest()
            if not path.exists():
                path.write_bytes(download(url))
            raw = path.read_bytes()
            if raw.startswith(b"%PDF"):
                with pymupdf.open(stream=raw,filetype="pdf") as pdf:
                    pages=[(p+1,pdf[p].get_text(sort=True)) for p in range(start-1,min(len(pdf),(e["end"] or len(pdf)+1)-1))]
            else:
                pages=[(0,BeautifulSoup(raw,"html.parser").get_text(" ",strip=True))]
        for page, txt in pages:
            if page and (page<start or e["end"] and page>=e["end"]):
                continue
            if KEYWORD.search(txt):
                for t in towns:
                    yield from parse(txt,t,tokens[t["id"]],url.split("#")[0]+(f"#page={page}" if page else ""),
                                     e["date"],name)


def merge(towns, path):
    by_id = {r["id"]:r for r in towns}
    approved = {}
    for row in csv.DictReader(path.open(encoding="utf-8-sig",newline="")) if path else []:
        if row["review"] != "승인":
            continue
        tid = row["id"]
        if (tid not in by_id or row["scope"]!="전체" or not official(row["source_url"]) or not NUMBER.search(row["notice_no"])
            or row["name"]!=by_id[tid]["name"] or row["district"]!=by_id[tid]["district"]):
            raise ValueError("검수 CSV의 범위·근거·대상지 확인 필요: "+tid)
        for key in ("candidate_date","source_as_of"):
            date.fromisoformat(row[key])
        if tid in approved and approved[tid]!=row:
            raise ValueError("한 대상지에 승인된 행이 여러 개입니다: "+tid)
        approved[tid]=row
    for town in towns:
        row=approved.get(town["id"])
        if row:
            prior=town.setdefault("field_evidence",{}).get("rights_cutoff_date") or {}
            proof=dict(source_url=row["source_url"], source_as_of=row["source_as_of"], notice_number=row["notice_no"])
            if town.get("rights_cutoff_date")!=row["candidate_date"] or any(prior.get(k)!=v for k,v in proof.items()):
                town["field_evidence"]["rights_cutoff_date"]={**proof,"kind":"reviewed_official_rights_notice",
                                                            "checked_on":date.today().isoformat()}
            town["rights_cutoff_date"]=row["candidate_date"]
        town["rights_base_date"]=town.get("rights_cutoff_date")
        town["rights_notice_no"]=(town.get("field_evidence",{}).get("rights_cutoff_date") or {}).get("notice_number") if town["rights_base_date"] else None


if __name__=="__main__":
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--crawl",action="store_true",help="서울시보 목차에서 권리산정 고시 검색")
    p.add_argument("--history-only",action="store_true",help="수록된 고시 이력에서만 검토 CSV 작성")
    p.add_argument("--start-year",type=int,default=2022)
    p.add_argument("--end-year",type=int,default=date.today().year)
    p.add_argument("--url",action="append",default=[],help="추가 서울시·정보몽땅 등 공식 HTML 또는 PDF 주소")
    p.add_argument("--catalog",type=Path,help="서울시보 목차 JSON의 로컬 사본")
    p.add_argument("--text-dir",type=Path,help="고시번호별 [[PDF p.N]] 본문 텍스트 캐시")
    p.add_argument("--cache",type=Path,default=Path(tempfile.gettempdir())/"moatown-rights-notices")
    p.add_argument("--output",type=Path,default=CSV)
    p.add_argument("--merge",type=Path,help="전체 범위로 검수 승인된 별도 CSV 병합")
    p.add_argument("--sync",action="store_true",help="현재 검증된 권리산정기준일과 스키마 동기화")
    args=p.parse_args()
    manifest=read(DATA/"latest.json")
    path=DATA/manifest["files"]["towns"]
    towns=read(path)
    if args.merge or args.sync:
        merge(towns,args.merge)
        write(path,towns)
        review_path=DATA/manifest["files"]["review"]
        review=read(review_path)
        missing=[t["id"] for t in towns if not t["rights_base_date"]]
        if review["missing_fields"].get("town_rights_cutoff_date")!=missing:
            review["missing_fields"]["town_rights_cutoff_date"]=missing
            write(review_path,review)
        manifest["coverage"]["towns_with_single_cutoff_date"]=sum(bool(t["rights_base_date"]) for t in towns)
        write(DATA/"latest.json",manifest)
    else:
        rows=list(candidates(towns,args))
        args.output.parent.mkdir(parents=True,exist_ok=True)
        with args.output.open("w",encoding="utf-8-sig",newline="") as out:
            writer=csv.DictWriter(out,fieldnames=COLUMNS,lineterminator="\n")
            writer.writeheader();writer.writerows(rows)
        print("검토 후보",len(rows),"원문 텍스트",sum(r["evidence"]=="원문 텍스트 후보" for r in rows))
