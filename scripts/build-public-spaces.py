"""Extract mapped facilities whose Seoul decision notice matches the town's notice.

Pass a directory containing OA-20283's notices.csv (CP949) and the September
2026 Seoul SHP archives named 21134.zip, 21129.zip, 20961.zip and 21130.zip.
Uses pyshp 2, pyproj and shapely 2. Coordinates are clipped to the published town.
"""
import csv
import hashlib
import io
import json
from pathlib import Path
import re
import sys
import zipfile

import shapefile
from pyproj import Transformer
from shapely import make_valid
from shapely.geometry import MultiPolygon, mapping, shape
from shapely.ops import transform

ROOT = Path(__file__).resolve().parents[1] / "moatown-data"
RELEASE = "2026-09-10"
CHECKED = "2026-11-25"
DECISIONS = "https://data.seoul.go.kr/dataList/OA-20283/S/1/datasetView.do"
LAYERS = {21134: "road", 21129: "space", 20961: "facility", 21130: "transport"}


def polygons(g):
    if g.geom_type == "Polygon":
        yield g
    elif hasattr(g, "geoms"):
        for part in g.geoms:
            yield from polygons(part)


def kind(layer, row):
    if layer == "space":
        return {"UQT200": "park", "UQT300": "green"}.get(row.LCLAS_CL, "open_space")
    return "facility" if layer == "transport" else layer


def read_json(path):
    return json.loads((ROOT / path).read_bytes())


def main(directory):
    manifest = read_json("latest.json")
    towns = read_json(manifest["files"]["towns"])
    to_local = Transformer.from_crs(4326, 5174, always_xy=True).transform
    to_world = Transformer.from_crs(5174, 4326, always_xy=True).transform
    boundaries = {f["properties"]["entity_id"]: transform(to_local, shape(f["geometry"]))
                  for f in read_json(manifest["files"]["boundaries"])["features"]
                  if f["properties"]["entity_type"] == "town"}
    index = {}
    for town in towns:
        for record in town.get("management_plan_notices", []):
            match = re.fullmatch(r"(.+?)\s*고시\s*제?\s*(\d{4}-\d+)호", record.get("notice_number") or "")
            if match and (record.get("notice_url") or record.get("source_url")):
                key = (match[1].strip(), match[2], record["notice_date"])
                index.setdefault(key, []).append((town["id"], record))
    with (directory / "notices.csv").open(encoding="cp949", errors="replace", newline="") as f:
        notices = {row["고시관리코드"]: row for row in csv.DictReader(f)}
    output = {}
    for number, layer in LAYERS.items():
        archive = directory / f"{number}.zip"
        checksum = hashlib.sha256(archive.read_bytes()).hexdigest()
        with zipfile.ZipFile(archive) as z:
            files = {ext: io.BytesIO(z.read(next(n for n in z.namelist() if n.lower().endswith("." + ext))))
                     for ext in ("dbf", "shp", "shx")}
        with shapefile.Reader(**files, encoding="cp949", encodingErrors="replace") as reader:
            for row in reader.iterRecords():
                notice = notices.get(row.NTFC_SN)
                if not notice:
                    continue
                key = (notice["고시기관"], notice["고시번호"], notice["고시일자"][:10])
                for tid, record in index.get(key, []):
                    if tid not in boundaries:
                        continue
                    geometry = make_valid(shape(reader.shape(row.oid).__geo_interface__))
                    intersection = geometry.intersection(boundaries[tid])
                    parts = list(polygons(intersection))
                    if not parts or intersection.area < 10:
                        continue
                    clipped = parts[0] if len(parts) == 1 else MultiPolygon(parts)
                    world = transform(to_world, clipped)
                    props = dict(id=row.PRESENT_SN, kind=kind(layer, row), name=row.DGM_NM,
                                 source_url=record.get("notice_url") or record["source_url"], source_label=record["notice_number"],
                                 source_as_of=record["notice_date"], checked_on=CHECKED,
                                 evidence="official_facility_geometry_matched_to_town_notice",
                                 dataset_url=f"https://data.seoul.go.kr/dataList/OA-{number}/F/1/datasetView.do",
                                 dataset_as_of=RELEASE, archive_sha256=checksum,
                                 notice_id=row.NTFC_SN, notice_title=notice["제목"])
                    output.setdefault(tid, []).append(dict(type="Feature", properties=props, geometry=mapping(world)))
    folder = ROOT / "plans" / "public-spaces"
    folder.mkdir(exist_ok=True)
    for tid, features in sorted(output.items()):
        features.sort(key=lambda f: f["properties"]["id"])
        collection = dict(type="FeatureCollection", town_id=tid, source_label="서울시 도시계획시설 공간정보",
                          notice_register_url=DECISIONS, source_as_of=RELEASE, checked_on=CHECKED,
                          status="관리계획 고시와 서울시 시설 도형을 대조해 대상지 안의 부분을 표시합니다.",
                          features=features)
        content=json.dumps(collection, ensure_ascii=False, separators=(",", ":"))
        (folder / f"{tid}.geojson").write_text(content+"\n", encoding="utf8")
        print(tid, len(features))
    print("검토 대상지", len(towns), "참고 외곽", len(boundaries), "고시와 도형 일치", len(output))


if __name__ == "__main__":
    main(Path(sys.argv[1]))
