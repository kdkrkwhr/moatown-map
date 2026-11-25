# /// script
# requires-python = ">=3.11"
# dependencies = ["openpyxl==3.1.5"]
# ///
"""Build the Sinwol current-building details with uv run scripts/build-sinwol-current.py.

An optional --cache-dir outside the repository retains the WFS responses, dictionary
and Seoul building register CSVs. Reusing it reproduces the same file offline.
"""

import argparse
import csv
import hashlib
import json
import re
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
# The 150 m buffer includes Hwagok-dong across the district line. These register
# serial prefixes were verified on records sharing parcel, date, floors and use.
TITLE_AREAS = (
    ("양천구", "신월동", "1147010300", "10161"),
    ("강서구", "화곡동", "1150010300", "10171"),
)


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
    for field, label in {**LINK_FIELDS, **dict(FIELDS.values())}.items():
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


def read_footprints(town):
    buildings = {}
    for entry in town["files"]:
        raw = (BUILDINGS / entry["path"]).read_bytes().replace(b"\r\n", b"\n")
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
    if row["a1"] == CHURCH_ID and row["a2"] == CHURCH_PNU and "".join((row["a24"] or "").split()) == CHURCH_NAME:
        details["name"] = row["a24"]
    return details


def add_roofs(records, buildings, rows, cache, checked):
    # Require one-to-one parcel / district-prefixed register ID matching between
    # the two snapshots. A parcel shared by several buildings is not a building ID.
    keys = {r["a1"]: (r["a2"], r["a19"]) for r in rows if r["a19"] and r["a2"]}
    multiplicity = Counter(keys.values())
    wanted = {key: bid for bid, key in keys.items() if multiplicity[key] == 1}
    downloads, matches, seen = [], {}, set()
    for district, dong, dong_code, prefix in TITLE_AREAS:
        params = {"srvType": "S", "infId": "OA-22424", "serviceKind": "1", "pageNo": "1",
                  "ssUserId": "SAMPLE_VIEW", "filterCol": "SGG_CD_NM", "txtFilter": district,
                  "strWhere": "", "strOrderby": ""}
        raw = fetch(Request(TITLE_DOWNLOAD, data=urlencode(params).encode()), cache, "csv")
        downloads.append({"district": district, "sha256": sha(raw)})
        reader = csv.DictReader(TextIOWrapper(BytesIO(raw), encoding="cp949", newline=""))
        if not reader.fieldnames or "건축물대장일련번호" not in reader.fieldnames:
            raise ValueError(f"Missing register CSV headers for {district}")
        for title in reader:
            if (title["시군구코드명"] != "서울특별시 " + district or title["법정동코드명"] != dong
                    or title["대지구분코드명"] != "대지"):
                continue
            pnu = dong_code + "1" + title["주지번"].zfill(4) + title["부지번"].zfill(4)
            serial = title["건축물대장일련번호"]
            if not serial.startswith(prefix):
                continue
            building_id = wanted.get((pnu, serial[len(prefix):]))
            if building_id is None:
                continue
            if building_id in seen:
                # Suppress a match if multiple title rows refer to the same candidate.
                matches.pop(building_id, None)
                continue
            seen.add(building_id)
            details = records[building_id]
            if (not title["지붕코드명"] or not details.get("approval_date")
                    or title["사용승인일자"] != details["approval_date"]
                    or title["지상층수"] != str(buildings[building_id]["floors"])
                    or title["지하층수"] != str(details.get("basement_floors"))
                    or title["구조코드명"] != details.get("structure")
                    or title["주용도코드명"] != details.get("use")):
                continue
            collected = datetime.fromisoformat(title["데이터수집일"]).date()
            if collected > checked:
                raise ValueError(f"Register timestamp after WFS retrieval for {building_id}")
            matches[building_id] = {"roof": title["지붕코드명"], "roof_collected_on": collected.isoformat()}
    if not matches:
        raise ValueError("No unambiguous register roof matches")
    for building_id, details in matches.items():
        records[building_id].update(details)
    dates = [d["roof_collected_on"] for d in matches.values()]
    return {"dataset": "서울시 건축물대장 표제부", "source_url": TITLE_URL, "download_url": TITLE_DOWNLOAD,
            "license": "이용허락범위 제한 없음", "date_field": "데이터수집일",
            "record_dates": {"first": min(dates), "last": max(dates)}, "downloads": downloads,
            "matching": "필지·대장 식별번호 일대일 대응 및 사용승인일·지상층·지하층·구조·주용도 일치"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache-dir", type=Path)
    parser.add_argument("--output", type=Path, default=BUILDINGS / "sinwol-details.json")
    args = parser.parse_args()
    if args.cache_dir:
        args.cache_dir.mkdir(parents=True, exist_ok=True)
    index = json.loads((BUILDINGS / "index.json").read_bytes())
    town = index["towns"][TOWN]
    buildings = read_footprints(town)
    dictionary_sha = dictionary_hash(index["column_dictionary_url"], args.cache_dir)
    source_date = date.fromisoformat(town["source_as_of"])
    fields = ["a1", "a2", "a9", "a11", "a13", "a19", "a22", "a27"]
    ids = sorted(set(buildings) - {CHURCH_ID})
    batches = [(ids[i:i + 100], fields) for i in range(0, len(ids), 100)]
    if CHURCH_ID in buildings:
        batches.append(([CHURCH_ID], fields + ["a24"]))
    records, pages, source_rows = {}, [], []
    for batch, columns in batches:
        rows, page = read_batch(index, batch, columns, args.cache_dir)
        pages.append(page)
        source_rows.extend(rows)
        for row in rows:
            building_id = row["a1"]
            details = describe(row, buildings[building_id], source_date)
            records[building_id] = details
    if records.keys() != buildings.keys():
        raise ValueError("Joined ID set differs from published footprint IDs")
    local_zone = timezone(timedelta(hours=9))
    checked = max(datetime.fromisoformat(page["timestamp"]).astimezone(local_zone).date() for page in pages)
    roof_source = add_roofs(records, buildings, source_rows, args.cache_dir, checked)
    field_metadata = {k: {"source": col.upper(), "label": label} for k, (col, label) in FIELDS.items()}
    field_metadata.update({
        "roof": {"dataset": "OA-22424", "source": "지붕코드명", "label": "대장상 지붕"},
        "roof_collected_on": {"dataset": "OA-22424", "source": "데이터수집일", "label": "표제부 자료수집일"},
    })
    counts = Counter(key for details in records.values() for key in details)
    result = {
        "town_id": TOWN, "dataset": index["dataset"], "source_url": index["source_url"],
        "source_as_of": source_date.isoformat(), "checked_on": checked.isoformat(),
        "catalog_url": index["catalog_url"], "license": index["license"], "license_url": index["license_url"],
        "wfs_url": index["wfs_url"], "layer": index["layer"],
        "column_dictionary_url": index["column_dictionary_url"], "column_dictionary_sha256": dictionary_sha,
        "name_verification_url": CHURCH_URL,
        "roof_source": roof_source, "fields": field_metadata,
        "stats": {"matched": len(records), "with_details": sum(bool(d) for d in records.values()),
                  "by_field": {k: counts[k] for k in field_metadata}},
        "audit": {"matched_ids_sha256": town["audit"]["matched_ids_sha256"], "wfs_batches": pages},
        "records": {building_id: records[building_id] for building_id in sorted(records)},
    }
    raw = json.dumps(result, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode() + b"\n"
    if len(raw) > 500_000:
        raise ValueError("Details exceed the 500 kB payload limit")
    with NamedTemporaryFile(dir=args.output.parent, delete=False) as stage:
        stage.write(raw)
    Path(stage.name).replace(args.output)
    print(json.dumps(result["stats"]), len(raw), sha(raw))


if __name__ == "__main__":
    main()
