# /// script
# requires-python = ">=3.11"
# dependencies = ["openpyxl==3.1.5"]
# ///
"""Build verified current-building details (default: the historical Sinwol extract).

Use --town TOWN_ID to select a town. --town extended processes all non-pilot
towns using --wfs-cache from build-pilot-buildings.py. --cache-dir retains the
pilot WFS responses, column dictionary and Seoul register CSVs for offline replay.
"""

import argparse
import csv
import hashlib
import json
import re
import sqlite3
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from io import BytesIO, TextIOWrapper
from pathlib import Path
from tempfile import NamedTemporaryFile
from urllib.parse import quote, urlencode, urlsplit
from urllib.request import Request, urlopen

from openpyxl import load_workbook


ROOT = Path(__file__).resolve().parents[1]
BUILDINGS = ROOT / "moatown-data" / "buildings"
TOWN = "mt-202603-public-067"
PILOT_FILES = {TOWN: "sinwol", "mt-202603-public-034": "beon", "mt-202603-public-010": "myeonmok"}
MAX_BYTES = 500_000
FIELDS = {
    "use": ("a9", "건축물용도명"),
    "structure": ("a11", "건축물구조명"),
    "approval_date": ("a13", "사용승인일자"),
    "basement_floors": ("a27", "지하층_수"),
    "name": ("a24", "건물명"),
}
LINK_FIELDS = {"a1": "GIS건물통합식별번호", "a2": "고유번호", "a19": "건축물ID", "a22": "데이터기준일자"}
# The parish publishes its own building name and lot (신월동 99-30).
# Only ask for the free-text name on the corresponding reviewed ID.
CHURCH_ID = "2012185115644480003700000000"
CHURCH_PNU = "1147010300100990030"
CHURCH_NAME = "천주교신월1동성당"
CHURCH_URL = "https://swfirst1.mycafe24.com/"
TITLE_URL = "https://data.seoul.go.kr/dataList/OA-22424/S/1/datasetView.do"
TITLE_DOWNLOAD = "https://datafile.seoul.go.kr/bigfile/iot/sheet/csv/download.do"
# Pilot by-ID WFS batches predate the city extract's A4 column. These legal
# dong names include adjoining districts touched by the original 150 m buffers.
PILOT_DONGS = {
    "1147010300": "서울특별시 양천구 신월동", "1150010300": "서울특별시 강서구 화곡동",
    "1130510200": "서울특별시 강북구 번동", "1132010700": "서울특별시 도봉구 창동",
    "1126010100": "서울특별시 중랑구 면목동", "1126010200": "서울특별시 중랑구 상봉동",
    "1126010500": "서울특별시 중랑구 망우동",
}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def fetch(request, cache, suffix):
    key = sha(request.full_url.encode() + b"\n" + (request.data or b""))
    path = cache / f"{key}.{suffix}" if cache else None
    if path and path.is_file():
        return path.read_bytes()
    with urlopen(request, timeout=90) as response:
        raw = response.read()
    if path:
        path.write_bytes(raw)
    return raw


def dictionary_hash(url, cache):
    parts = urlsplit(url)
    raw = fetch(Request(parts._replace(path=quote(parts.path)).geturl()), cache, "xlsx")
    workbook = load_workbook(BytesIO(raw), read_only=True, data_only=True)
    try:
        rows = workbook["테이블정의서(전체)"].values
        columns = {row[6].lower(): row[7] for row in rows if row[3] == "AL_D010"}
    finally:
        workbook.close()
    for field, label in {**LINK_FIELDS, **dict(FIELDS.values()), "a4": "법정동명"}.items():
        if columns.get(field) != label:
            raise ValueError(f"Review changed AL_D010 dictionary entry {field}: {columns.get(field)}")
    return sha(raw)


def read_batch(index, ids, fields, cache):
    """Use the Seoul WFS 1.1 POST convention from build-pilot-buildings.py, by exact A1."""
    clauses = [
        f"<ogc:PropertyIsEqualTo><ogc:PropertyName>a1</ogc:PropertyName>"
        f"<ogc:Literal>{building_id}</ogc:Literal></ogc:PropertyIsEqualTo>"
        for building_id in ids
    ]
    matches = clauses[0] if len(ids) == 1 else "<ogc:Or>" + "".join(clauses) + "</ogc:Or>"
    properties = "".join(f"<wfs:PropertyName>{field}</wfs:PropertyName>" for field in fields)
    xml = f"""<wfs:GetFeature xmlns:wfs="http://www.opengis.net/wfs"
      xmlns:landbiz="http://www.opengis.net/wfs" xmlns:ogc="http://www.opengis.net/ogc"
      service="WFS" version="1.1.0" outputFormat="application/json" maxFeatures="{len(ids) + 1}">
      <wfs:Query typeName="{index['layer']}">{properties}
      <ogc:Filter>{matches}</ogc:Filter></wfs:Query></wfs:GetFeature>"""
    request = Request(index["wfs_url"], data=urlencode({"body": quote(xml, safe="")}).encode(),
                      headers={"Referer": index["source_url"]})
    raw = fetch(request, cache, "json")
    page = json.loads(raw)
    rows = [feature["properties"] for feature in page["features"]]
    if (page["numberMatched"] != len(ids) or page["numberReturned"] != len(rows)
            or len(rows) != len(ids) or {row["a1"] for row in rows} != set(ids)
            or any(set(row) != set(fields) for row in rows)):
        raise ValueError("Incomplete or ambiguous WFS join for batch beginning " + ids[0])
    return rows, {"first_id": ids[0], "count": len(rows), "timestamp": page["timeStamp"], "sha256": sha(raw)}


def read_footprints(town, directory=BUILDINGS):
    buildings = {}
    for entry in town["files"]:
        raw = (directory / entry["path"]).read_bytes().replace(b"\r\n", b"\n")
        if sha(raw) != entry["sha256"]:
            raise ValueError(f"Footprint index hash mismatch: {entry['path']}")
        for feature in json.loads(raw)["features"]:
            props = feature["properties"]
            building_id = props["id"]
            if not re.fullmatch(r"\d{28}", building_id) or building_id in buildings:
                raise ValueError(f"Invalid or duplicate footprint ID: {building_id}")
            buildings[building_id] = props
    if sha("\n".join(sorted(buildings)).encode()) != town["audit"]["matched_ids_sha256"]:
        raise ValueError("Footprint ID set differs from published audit")
    return buildings


def describe(row, footprint, source_date):
    if date.fromisoformat(row["a22"].removesuffix("Z")) != source_date:
        raise ValueError(f"Snapshot mismatch for {row['a1']}")
    approved = date.fromisoformat(row["a13"]) if row["a13"] else None
    if ((approved.year if approved else None) != footprint["approval_year"]
            or approved and approved > source_date):
        raise ValueError(f"Approval date mismatch for {row['a1']}")
    # Unlinked WFS footprints still report a default basement count of zero.
    if not row["a19"]:
        return {}
    details = {key: row[col] for key, (col, _) in FIELDS.items()
               if key != "name" and row[col] is not None and row[col] != ""}
    if "basement_floors" in details:
        floors = details["basement_floors"]
        if type(floors) is not int or floors < 0:
            raise ValueError(f"Invalid basement floor count for {row['a1']}")
    if row["a1"] == CHURCH_ID and row["a2"] == CHURCH_PNU and "".join((row.get("a24") or "").split()) == CHURCH_NAME:
        details["name"] = row["a24"]
    return details


def register_rows(reader, district, prefixes):
    for title in reader:
        if title["시군구코드명"] != "서울특별시 " + district:
            continue
        serial = title["건축물대장일련번호"]
        if not serial.isascii() or not serial.isdecimal() or len(serial) <= 5:
            continue
        prefixes[serial[:5]] += 1
        kind = {"대지": "1", "산": "2"}.get(title["대지구분코드명"])
        main, sub = title["주지번"], title["부지번"] or "0"
        if not kind or not all(re.fullmatch(r"[0-9]{1,4}", value) for value in (main, sub)):
            continue
        yield (district, title["법정동코드명"], kind + main.zfill(4) + sub.zfill(4), serial,
               title["사용승인일자"], title["지상층수"], title["지하층수"], title["구조코드명"],
               title["주용도코드명"], title["지붕코드명"], title["데이터수집일"])


class Registers:
    """Download and parse each district CSV once, retaining a disk-backed exact-key index."""
    def __init__(self, cache):
        self.cache = cache
        self.db = sqlite3.connect("")  # SQLite removes this temporary database on close.
        self.db.execute("""CREATE TABLE titles (district, dong, lot, serial, approved, floors,
                         basement, structure, usage, roof, collected)""")
        self.db.execute("CREATE INDEX title_key ON titles(district, dong, lot, serial)")
        self.districts = {}
        address_index = json.loads((ROOT / "moatown-data/addresses/index.json").read_bytes())
        self.district_names = {row["code"]: row["name"] for row in address_index["districts"]}

    def load(self, district):
        if district in self.districts:
            return self.districts[district]
        params = {"srvType": "S", "infId": "OA-22424", "serviceKind": "1", "pageNo": "1",
                  "ssUserId": "SAMPLE_VIEW", "filterCol": "SGG_CD_NM", "txtFilter": district,
                  "strWhere": "", "strOrderby": ""}
        raw = fetch(Request(TITLE_DOWNLOAD, data=urlencode(params).encode()), self.cache, "csv")
        # A Gangbuk free-text column has a malformed byte. Comparisons with damaged
        # keys fail closed, and both output fields must be intact to publish them.
        reader = csv.DictReader(TextIOWrapper(BytesIO(raw), encoding="cp949", errors="replace", newline=""))
        prefixes = Counter()
        with self.db:
            self.db.executemany("INSERT INTO titles VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                                register_rows(reader, district, prefixes))
        dominant = prefixes.most_common(1)
        if not dominant or dominant[0][1] * 2 <= prefixes.total():
            raise ValueError(f"No unique majority register serial prefix for {district}")
        self.districts[district] = (dominant[0][0], sha(raw))
        return self.districts[district]

    def add_roofs(self, records, buildings, rows, checked, is_pilot):
        keys = {row["a1"]: (row["a2"], row["a19"]) for row in rows if row["a19"] and row["a2"]}
        multiplicity = Counter(keys.values())
        downloads, dates = {}, []
        for row in rows:
            bid = row["a1"]
            if bid not in keys or multiplicity[keys[bid]] != 1:
                continue
            pnu, building_id = keys[bid]
            if not re.fullmatch(r"[0-9]{19}", pnu):
                continue
            district = self.district_names.get(pnu[:5])
            if not district:  # A Seoul buffer may extend into another province.
                continue
            area = PILOT_DONGS.get(pnu[:10]) if is_pilot else row["a4"]
            heading = f"서울특별시 {district} "
            if not area or not area.startswith(heading):
                continue
            dong = area[len(heading):]
            prefix, digest = self.load(district)
            downloads[district] = digest
            matches = self.db.execute(
                """SELECT approved, floors, basement, structure, usage, roof, collected FROM titles
                   WHERE district=? AND dong=? AND lot=? AND serial=? LIMIT 2""",
                (district, dong, pnu[10:], prefix + building_id)).fetchall()
            if len(matches) != 1:
                continue
            approved, floors, basement, structure, use, roof, collected = matches[0]
            details = records[bid]
            if (not roof or "\ufffd" in roof or not collected or "\ufffd" in collected
                    or not details.get("approval_date") or details["approval_date"] != approved
                    or str(buildings[bid]["floors"]) != floors or str(details.get("basement_floors")) != basement
                    or details.get("structure") != structure or details.get("use") != use):
                continue
            day = datetime.fromisoformat(collected).date()
            if day > checked:
                raise ValueError(f"Register timestamp after WFS retrieval for {bid}")
            details.update(roof=roof, roof_collected_on=day.isoformat())
            dates.append(day.isoformat())
        return {"dataset": "서울시 건축물대장 표제부", "source_url": TITLE_URL, "download_url": TITLE_DOWNLOAD,
                "license": "이용허락범위 제한 없음", "date_field": "데이터수집일",
                "record_dates": {"first": min(dates), "last": max(dates)} if dates else None,
                "downloads": [{"district": district, "sha256": digest} for district, digest in downloads.items()],
                "matching": "필지·대장 식별번호 일대일 대응 및 사용승인일·지상층·지하층·구조·주용도 일치"}


def pilot_rows(index, buildings, cache, include_church):
    fields = ["a1", "a2", "a9", "a11", "a13", "a19", "a22", "a27"]
    named = {CHURCH_ID} & buildings.keys() if include_church else set()
    ids = sorted(buildings.keys() - named)
    batches = [(ids[i:i + 100], fields) for i in range(0, len(ids), 100)]
    if named:
        batches.append(([CHURCH_ID], fields + ["a24"]))
    rows, pages = [], []
    for batch, columns in batches:
        matches, page = read_batch(index, batch, columns, cache)
        rows.extend(matches)
        pages.append(page)
    return rows, {"wfs_batches": pages}, pages


def bbox_rows(town_id, town, buildings, wfs_cache):
    if not wfs_cache:
        raise ValueError(f"--wfs-cache must point to the footprint builder's WFS pages for {town_id}")
    rows = []
    pages = town["audit"]["wfs_pages"]
    for page in pages:
        for path in wfs_cache.glob(f"{town_id}-*-{page['start_index']}.json"):
            raw = path.read_bytes()
            if sha(raw) == page["sha256"]:
                break
        else:
            raise ValueError(f"{town_id}: missing exact cached WFS page {page['sha256']}")
        response = json.loads(raw)
        if (response["timeStamp"] != page["timestamp"] or response["numberReturned"] != page["number_returned"]
                or len(response["features"]) != page["number_returned"]):
            raise ValueError(f"{town_id}: WFS page differs from footprint audit")
        rows.extend(feature["properties"] for feature in response["features"]
                    if feature["properties"]["a1"] in buildings)
    return rows, {"wfs_pages": pages}, pages


def encoded(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode() + b"\n"


def write_file(path, content):
    path.parent.mkdir(exist_ok=True, parents=True)
    with NamedTemporaryFile(dir=path.parent, delete=False) as stage:
        stage.write(content)
    Path(stage.name).replace(path)


def publish(path, result, public_parent):
    data = encoded(result)
    if len(data) <= MAX_BYTES:
        write_file(path, data)
        return
    records = result.pop("records")
    result["record_files"] = []
    prefix = encoded({"town_id": result["town_id"], "records": {}})[:-3]  # through the opening records brace
    suffix = b"}}\n"

    def flush(parts):
        content = prefix + b",".join(parts) + suffix
        chunk = path.with_name(f"{path.stem}-{len(result['record_files']) + 1:02}{path.suffix}")
        if len(content) > MAX_BYTES:
            raise ValueError(f"Single record exceeds the payload limit: {chunk}")
        write_file(chunk, content)
        result["record_files"].append({"path": public_parent + chunk.name, "bytes": len(content),
                                       "sha256": sha(content), "count": len(parts)})
    parts = []
    size = len(prefix) + len(suffix)
    for bid, details in records.items():
        pair = encoded({bid: details})[1:-2]
        if parts and size + 1 + len(pair) > MAX_BYTES:
            flush(parts)
            parts = []
            size = len(prefix) + len(suffix)
        size += len(pair) + bool(parts)
        parts.append(pair)
    flush(parts)
    data = encoded(result)
    if len(data) > MAX_BYTES:
        raise ValueError(f"Index exceeds the payload limit: {path}")
    write_file(path, data)


def build_town(town_id, index, directory, path, args, dictionary_sha, registers):
    town = index["towns"][town_id]
    buildings = read_footprints(town, directory)
    source_date = date.fromisoformat(town["source_as_of"])
    is_pilot = town_id in PILOT_FILES
    if is_pilot:
        rows, audit, pages = pilot_rows(index, buildings, args.cache_dir, town_id == TOWN)
    else:
        rows, audit, pages = bbox_rows(town_id, town, buildings, args.wfs_cache)
    records = {row["a1"]: describe(row, buildings[row["a1"]], source_date) for row in rows}
    if len(rows) != len(records) or records.keys() != buildings.keys():
        raise ValueError(f"{town_id}: joined IDs differ from unique published footprint IDs")
    local_zone = timezone(timedelta(hours=9))
    checked = max(datetime.fromisoformat(page["timestamp"]).astimezone(local_zone).date() for page in pages)
    roof_source = registers.add_roofs(records, buildings, rows, checked, is_pilot)
    field_metadata = {k: {"source": col.upper(), "label": label} for k, (col, label) in FIELDS.items()
                      if k != "name" or town_id == TOWN}
    field_metadata.update({
        "roof": {"dataset": "OA-22424", "source": "지붕코드명", "label": "대장상 지붕"},
        "roof_collected_on": {"dataset": "OA-22424", "source": "데이터수집일", "label": "표제부 자료수집일"},
    })
    counts = Counter(key for details in records.values() for key in details)
    result = {
        "town_id": town_id, "dataset": index["dataset"], "source_url": index["source_url"],
        "source_as_of": source_date.isoformat(), "checked_on": checked.isoformat(),
        "catalog_url": index["catalog_url"], "license": index["license"], "license_url": index["license_url"],
        "wfs_url": index["wfs_url"], "layer": index["layer"],
        "column_dictionary_url": index["column_dictionary_url"], "column_dictionary_sha256": dictionary_sha,
        **({"name_verification_url": CHURCH_URL} if town_id == TOWN else {}),
        "roof_source": roof_source, "fields": field_metadata,
        "stats": {"matched": len(records), "with_details": sum(bool(d) for d in records.values()),
                  "by_field": {k: counts[k] for k in field_metadata}},
        "audit": {"matched_ids_sha256": town["audit"]["matched_ids_sha256"], **audit},
        "records": {building_id: records[building_id] for building_id in sorted(records)},
    }
    publish(path, result, "" if is_pilot else "details/")
    print(town_id, json.dumps(result["stats"]), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--town", default=TOWN, help="Town ID, pilot short name, extended or all")
    parser.add_argument("--cache-dir", type=Path)
    parser.add_argument("--wfs-cache", type=Path, help="Directory of original BBOX WFS responses")
    parser.add_argument("--index", type=Path, default=BUILDINGS / "index.json")
    parser.add_argument("--output", type=Path, help="Override the detail JSON path for a single town")
    args = parser.parse_args()
    if args.cache_dir:
        args.cache_dir.mkdir(parents=True, exist_ok=True)
    index = json.loads(args.index.read_bytes())
    if args.town in ("all", "extended"):
        ids = [tid for tid in index["towns"] if args.town == "all" or tid not in PILOT_FILES]
    else:
        tid = next((k for k, v in PILOT_FILES.items() if v == args.town), args.town)
        ids = [tid] if tid in index["towns"] else []
    if not ids or (args.output and len(ids) != 1):
        parser.error("Select one indexed town for --output, or use an indexed town set.")
    dictionary_sha = dictionary_hash(index["column_dictionary_url"], args.cache_dir)
    directory = args.index.parent
    registers = Registers(args.cache_dir)
    try:
        for tid in ids:
            path = directory / (f"{PILOT_FILES[tid]}-details.json" if tid in PILOT_FILES else f"details/{tid}.json")
            build_town(tid, index, directory, args.output or path, args, dictionary_sha, registers)
    finally:
        registers.db.close()


if __name__ == "__main__":
    main()
