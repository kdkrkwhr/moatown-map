# /// script
# requires-python = ">=3.11"
# dependencies = ["openpyxl==3.1.5", "shapely==2.2.0", "pyproj==3.7.2"]
# ///
"""Verify reviewed building IDs against the Seoul register and matching official address/footprint records.

Run with uv run scripts/build-register-heights.py --cache-dir PATH. Reuse the cache for
byte-for-byte replay. Use a new directory to check later releases of the public sources.
"""
import argparse
import csv
import json
import math
import re
import runpy
from collections import Counter
from datetime import date, datetime
from io import BytesIO, TextIOWrapper
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request
from zipfile import ZipFile

import shapely
from shapely.geometry import shape

SCRIPTS = Path(__file__).resolve().parent
GIS = runpy.run_path(str(SCRIPTS / "build-sinwol-height-evidence.py"))
DETAIL = runpy.run_path(str(SCRIPTS / "build-sinwol-current.py"))
ROOT = GIS["ROOT"]
POSTAL_URL = "https://www.epost.go.kr/search/zipcode/areacdAddressDown.jsp"
POSTAL_FILE = "https://www.epost.go.kr/search/areacd/zipcode_DB.zip"
# Review of the 108 town extracts yielded two positive register heights for missing
# primary heights. The Siheung gym has a conflicting topographic floor count.
REVIEWED = {"2013212534434477508300000000": ["mt-202603-public-056"]}


def one(rows, label):
    if len(rows) != 1:
        raise ValueError(f"{label}: expected one match, found {len(rows)}")
    return rows[0]


def postal_address(source_id, cache):
    webpage = DETAIL["fetch"](Request(POSTAL_URL), cache, "html").decode("utf8")
    stamp = re.search(r"도로명주소 및 우편번호는\s*(\d{4}\.\d{2}\.\d{2})\s*기준", webpage)
    if not stamp:
        raise ValueError("Missing Korea Post address database release date")
    release = date.fromisoformat(stamp[1].replace(".", "-")).isoformat()
    raw = DETAIL["fetch"](Request(POSTAL_FILE), cache, "zip")
    with ZipFile(BytesIO(raw)) as archive:
        seoul = one([info for info in archive.infolist() if
                     (info.filename if info.flag_bits & 0x800 else info.filename.encode("cp437").decode("cp949"))
                     == "서울특별시.txt"], "Korea Post Seoul member")
        data = archive.read(seoul)
    reader = csv.DictReader(TextIOWrapper(BytesIO(data), encoding="utf-8-sig"), delimiter="|")
    row = one([r for r in reader if r["건물관리번호"] == source_id], "Korea Post building ID")
    return row, release, DETAIL["sha"](data)


def register_title(gis, postal, cache):
    district = postal["시군구"]
    params = {"srvType": "S", "infId": "OA-22424", "serviceKind": "1", "pageNo": "1",
              "ssUserId": "SAMPLE_VIEW", "filterCol": "SGG_CD_NM", "txtFilter": district,
              "strWhere": "", "strOrderby": ""}
    raw = DETAIL["fetch"](Request(DETAIL["TITLE_DOWNLOAD"], data=urlencode(params).encode()), cache, "csv")
    reader = csv.DictReader(TextIOWrapper(BytesIO(raw), encoding="cp949", errors="replace", newline=""))
    prefixes, serials = Counter(), Counter()
    matches = []
    for row in reader:
        if row["시군구코드명"] != f"서울특별시 {district}":
            continue
        serial = row["건축물대장일련번호"]
        if not serial.isascii() or not serial.isdigit() or len(serial) <= 5:
            continue
        prefixes[serial[:5]] += 1
        serials[serial] += 1
        if serial[5:] == gis["a19"]:
            matches.append(row)
    prefix, count = prefixes.most_common(1)[0]
    serial = prefix + gis["a19"]
    if count * 2 <= prefixes.total() or serials[serial] != 1:
        raise ValueError("Ambiguous district register identifier")
    title = one([row for row in matches if row["건축물대장일련번호"] == serial], "register serial")
    lot = {"대지": "1", "산": "2"}.get(title["대지구분코드명"], "?")
    lot += title["주지번"].zfill(4) + title["부지번"].zfill(4)
    postal_pnu = (postal["법정동코드"] + {"0": "1", "1": "2"}[postal["산여부"]] +
                  postal["지번본번"].zfill(4) + postal["지번부번"].zfill(4))
    if not (gis["a2"] == postal_pnu and gis["a2"][10:] == lot
            and gis["a4"] == title["시군구코드명"] + " " + title["법정동코드명"]
            and postal["법정동명"] == title["법정동코드명"] == title["새주소법정동코드명"]
            and title["새주소도로코드명"] == postal["도로명"] and postal["지하여부"] == "0"
            and title["새주소지상지하구분코드명"] == "지상"
            and int(title["새주소주지번"]) == int(postal["건물번호본번"])
            and int(title["새주소부지번"] or 0) == int(postal["건물번호부번"] or 0)):
        raise ValueError("Register and road or parcel address differ")
    return title, DETAIL["sha"](raw)


def verify(bid, town_ids, index, cache):
    features = [one([f for f in GIS["published_buildings"](tid, index["towns"][tid])
                     if f["properties"]["id"] == bid], tid) for tid in town_ids]
    published = features[0]
    if any(f["geometry"] != published["geometry"] or f["properties"]["height_m"] is not None for f in features):
        raise ValueError("Published building geometry changed or already has primary height")
    geometry = shapely.transform(shape(published["geometry"]), GIS["TO_METRES"].transform, interleaved=False)
    w, s, e, n = geometry.bounds
    bounds = (math.floor(w), math.floor(s), math.ceil(e), math.ceil(n))
    audit, dates = {}, set()

    def source(layer, fields, key=None):
        rows, checked, hashes = GIS["fetch"](layer, fields, bounds, cache, source_id=key)
        audit[f"{layer}/{fields[0]}/{key or 'bbox'}"] = hashes
        dates.add(checked)
        return rows

    primary = one(source(GIS["UNITY"], ("a1", "a2", "a19", "a4", "a16", "a26", "a22"), bid), "GIS ID")
    g = primary["properties"]
    gis_geom = shape(primary["geometry"])
    gis_iou = geometry.intersection(gis_geom).area / geometry.union(gis_geom).area
    if gis_iou < .98 or g["a1"] != bid or not g["a19"] or g["a16"] or g["a26"]:
        raise ValueError("Original GIS footprint or registry link differs")
    parcel = source(GIS["UNITY"], ("a2", "a1", "a19"), g["a2"])
    linked = one([f for f in parcel if f["properties"]["a19"] == g["a19"]], "same PNU and registry ID")
    if linked["id"] != primary["id"]:
        raise ValueError("Different GIS feature for the same register ID")
    road = source(GIS["ROAD"], ("bd_mgt_sn", "gro_flo_co"))
    j, road_iou = one(GIS["overlaps"](geometry, GIS["geometry_index"](road)), "road footprint")
    if road_iou <= .9:
        raise ValueError("Insufficient road footprint overlap")
    road_id = road[j]["properties"]["bd_mgt_sn"]
    proof = GIS["verify_road_candidate"](bid, road[j], cache, one(sorted(dates), "source date"))
    if not proof or road_id[:19] != g["a2"]:
        raise ValueError("Road footprint or reverse GIS identity is ambiguous")
    topo = source(GIS["NRM"], ("ufid", "flr_num", "h_date"))
    k, topo_iou = one(GIS["overlaps"](geometry, GIS["geometry_index"](topo)), "topographic footprint")
    postal, postal_as_of, postal_hash = postal_address(road_id, cache)
    title, title_hash = register_title(g, postal, cache)
    floors, height = int(title["지상층수"]), float(title["높이"])
    measured_area = float(title["건축면적"])
    as_of = date.fromisoformat(g["a22"].removesuffix("Z"))
    approved = date.fromisoformat(title["사용승인일자"])
    collected = datetime.fromisoformat(title["데이터수집일"]).date()
    checked = one(sorted(dates), "source date")
    if (not 0 < height <= 400 or floors < 1 or height / floors < 1.2 or (height >= 30 and height / floors > 20)
            or approved > as_of or collected < approved or collected > date.fromisoformat(checked)
            or title["주부속구분코드명"] != "주건축물" or int(title["부속건축물수"] or 0) > 0
            or min(measured_area, geometry.area) / max(measured_area, geometry.area) < .85
            or int(road[j]["properties"]["gro_flo_co"]) != floors or topo_iou < .6
            or int(topo[k]["properties"]["flr_num"]) != floors):
        raise ValueError("Register height, date, area or floor count lacks corroboration")
    return {"town_ids": town_ids, "height_m": height, "floors": floors, "source_url": DETAIL["TITLE_URL"],
            "registry_collected_on": collected.isoformat(), "register_serial": title["건축물대장일련번호"],
            "pnu": g["a2"], "method": "exact_register_id_parcel_and_road_footprint",
            "approval_date": approved.isoformat(), "road_address": f"{postal['도로명']} {postal['건물번호본번']}" +
            (f"-{postal['건물번호부번']}" if int(postal['건물번호부번'] or 0) else ""),
            "gis_register_id": g["a19"], "gis_source_as_of": as_of.isoformat(), "gis_iou": round(gis_iou, 6),
            "road_building_id": road_id, "road_iou": round(road_iou, 6), "road_floors": floors,
            "topographic_id": topo[k]["properties"]["ufid"], "topographic_iou": round(topo_iou, 6),
            "topographic_floors": floors, "footprint_area_m2": round(geometry.area, 2),
            "register_area_m2": measured_area, "checked_on": checked, "postal_as_of": postal_as_of,
            "registry_csv_sha256": title_hash, "postal_seoul_txt_sha256": postal_hash,
            "wfs_pages_sha256": audit, "road_verification": proof}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache-dir", required=True, type=Path)
    parser.add_argument("--output", type=Path, default=ROOT / "registry-heights.json")
    args = parser.parse_args()
    args.cache_dir.mkdir(parents=True, exist_ok=True)
    index = json.loads((ROOT / "index.json").read_bytes())
    records = {bid: verify(bid, ids, index, args.cache_dir) for bid, ids in REVIEWED.items()}
    result = {"source": "서울특별시 건축물대장 표제부", "source_url": DETAIL["TITLE_URL"],
              "height_field": "높이", "address_source_url": POSTAL_URL,
              "geometry_source_url": GIS["MAP"],
              "method_note": "GIS 건축물ID와 표제부 일련번호를 같은 필지에서 대조했다. 도로명주소 건물관리번호·우편번호 DB의 도로명주소·표제부 주소가 일치하고 도로명주소 도형 및 수치지형도의 지상층수가 모두 표제부와 일치한 건물에 표제부 높이(m)를 사용했다.",
              "records": records}
    GIS["atomic_write"](args.output, (json.dumps(result, ensure_ascii=False, indent=2) + "\n").encode())


if __name__ == "__main__":
    main()
