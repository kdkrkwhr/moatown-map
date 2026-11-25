# /// script
# requires-python = ">=3.11"
# dependencies = ["shapely==2.2.0", "pyproj==3.7.2", "numpy==2.4.6"]
# ///
"""Build the three static building extracts with 'uv run scripts/build-pilot-buildings.py'.

Use --cache-dir OUTSIDE_THE_REPO to retain and replay the WFS pages used for a build.
The national AL_D010 column dictionary also applies to Seoul's tl_unity_buld layer.
"""

import argparse
import gzip
import hashlib
import json
import math
import tempfile
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

import numpy as np
import shapely
from pyproj import Transformer
from shapely.geometry import mapping, shape


ROOT = Path(__file__).resolve().parents[1]
TOWN_IDS = tuple(f"mt-202603-public-{n}" for n in ("010", "034", "067"))
MAP_URL = "https://land.seoul.go.kr/land/map/land/map.do"
WFS = "https://land.seoul.go.kr/land/geoserver/wfs.do"
LAYER = "landbiz:tl_unity_buld"
PAGE_SIZE = 1000
MAX_BYTES = 500_000
TO_METRES = Transformer.from_crs(4326, 5179, always_xy=True)
TO_LONLAT = Transformer.from_crs(5179, 4326, always_xy=True)
FIELDS = {
    "geom": "건물 전체 도형 (EPSG:5179, m)",
    "a1": "GIS건물통합식별번호",
    "a13": "사용승인일자",
    "a16": "높이(m)",
    "a19": "건축물ID (원자료의 대장 연결 지표)",
    "a22": "데이터기준일자",
    "a26": "지상층_수",
}


def encode(obj):
    return json.dumps(obj, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode()


def digest(content):
    return hashlib.sha256(content).hexdigest()


def read_source(bounds, cache_dir, town_id):
    """WFS 1.1 EPSG short form uses x/y on this server. Check every returned WFS row ID."""
    xmin, ymin, xmax, ymax = bounds
    key = digest(encode([WFS, LAYER, list(FIELDS), bounds]))[:16]
    pages, rows, ids = [], [], set()
    total = None
    while total is None or len(rows) < total:
        start = len(rows)
        cached = cache_dir / f"{town_id}-{key}-{start}.json" if cache_dir else None
        if cached and cached.exists():
            raw = cached.read_bytes()
        else:
            fields = "".join(f"<wfs:PropertyName>{field}</wfs:PropertyName>" for field in FIELDS)
            xml = f"""<wfs:GetFeature xmlns:wfs="http://www.opengis.net/wfs"
                xmlns:landbiz="http://www.opengis.net/wfs" xmlns:ogc="http://www.opengis.net/ogc"
                xmlns:gml="http://www.opengis.net/gml" service="WFS" version="1.1.0"
                outputFormat="application/json" maxFeatures="{PAGE_SIZE}" startIndex="{start}">
                <wfs:Query typeName="{LAYER}" srsName="EPSG:5179">{fields}
                  <ogc:Filter><ogc:BBOX><ogc:PropertyName>geom</ogc:PropertyName>
                    <gml:Envelope srsName="EPSG:5179"><gml:lowerCorner>{xmin} {ymin}</gml:lowerCorner>
                    <gml:upperCorner>{xmax} {ymax}</gml:upperCorner></gml:Envelope>
                  </ogc:BBOX></ogc:Filter><ogc:SortBy><ogc:SortProperty>
                    <ogc:PropertyName>a1</ogc:PropertyName><ogc:SortOrder>ASC</ogc:SortOrder>
                  </ogc:SortProperty></ogc:SortBy></wfs:Query></wfs:GetFeature>"""
            request = Request(WFS, data=urlencode({"body": quote(xml, safe="")}).encode(),
                              headers={"Referer": MAP_URL})
            with urlopen(request, timeout=90) as response:
                raw = response.read()
        page = json.loads(raw)
        features = page["features"]
        if total is None:
            total = page["numberMatched"]
        if (total != page["numberMatched"] or not features or
                len(features) != page["numberReturned"] or start + len(features) > total or
                not page["crs"]["properties"]["name"].endswith("::5179")):
            raise ValueError(f"{town_id}: incomplete or inconsistent WFS page at {start}")
        for row in features:
            feature_id = row["id"]
            if not feature_id or feature_id in ids or not row["properties"]["a1"]:
                raise ValueError(f"{town_id}: missing building ID or duplicate WFS row {feature_id}")
            ids.add(feature_id)
        if cached and not cached.exists():
            cached.write_bytes(raw)
        pages.append({"start_index": start, "number_returned": len(features),
                      "timestamp": page["timeStamp"], "sha256": digest(raw)})
        rows.extend(features)
    return rows, pages


def topology(geometry):
    return sorted(len(polygon.interiors) for polygon in shapely.get_parts(geometry))


def output_geometry(original, building_id, reviews):
    geographic = shapely.transform(original, TO_LONLAT.transform, interleaved=False)
    rounded = shapely.transform(geographic, lambda coordinates: np.round(coordinates, 6))
    rounded = shapely.remove_repeated_points(rounded)
    if not rounded.is_valid:
        # Independent rounding can cross edges a few centimetres apart. Snap-round the
        # original polygon on the same grid and check every part and interior ring below.
        reason = shapely.is_valid_reason(rounded)
        snapped = shapely.set_precision(geographic, 0.000001)
        rounded = shapely.transform(snapped, lambda coordinates: np.round(coordinates, 6))
        reviews.append({"id": building_id, "reason": reason, "resolution": "topology_preserving_grid_snap"})
    if (rounded.is_empty or not rounded.is_valid or rounded.area <= 0 or
            topology(original) != topology(rounded)):
        raise ValueError(f"{building_id}: polygon parts or rings lost at six decimals")
    if rounded.geom_type == "MultiPolygon" and len(rounded.geoms) == 1:
        rounded = rounded.geoms[0]
    return mapping(shapely.orient_polygons(rounded))


def building_properties(source, inside, snapshot):
    approval = date.fromisoformat(source["a13"]) if source["a13"] else None
    if approval and approval > snapshot:
        raise ValueError(f"{source['a1']}: approval after the snapshot")
    age = snapshot.year - approval.year if approval else None
    tier = "unknown" if age is None else "30_plus" if age >= 30 else "20_to_29" if age >= 20 else "under_20"
    floors = source["a26"]
    floors = int(floors) if floors and floors > 0 and int(floors) == floors else None
    height = source["a16"]
    height_source = None
    if height and math.isfinite(height) and height > 0:
        height_source = "official"
    elif floors:
        height, height_source = floors * 3, "estimated_from_floors"
    else:
        height = None
    return {"id": source["a1"], "approval_year": approval.year if approval else None,
            "age_years": age, "age_tier": tier, "floors": floors, "height_m": height,
            "height_source": height_source, "is_inside_town": inside}


def package(directory, town_id, features, expected_ids):
    prefix = b'{"type":"FeatureCollection","features":['
    suffix = b"]}\n"
    chunks, chunk = [], []
    size = len(prefix) + len(suffix)
    for feature in features:
        data = encode(feature)
        if len(prefix) + len(data) + len(suffix) > MAX_BYTES:
            raise ValueError(f"{feature['properties']['id']}: a single building exceeds {MAX_BYTES} bytes")
        if chunk and size + 1 + len(data) > MAX_BYTES:
            chunks.append(chunk)
            chunk, size = [], len(prefix) + len(suffix)
        size += len(data) + bool(chunk)
        chunk.append(data)
    if chunk:
        chunks.append(chunk)
    files, published = [], []
    for i, part in enumerate(chunks, 1):
        name = f"{town_id}.geojson" if len(chunks) == 1 else f"{town_id}-{i:02}.geojson"
        content = prefix + b",".join(part) + suffix
        path = directory / name
        path.write_bytes(content)
        restored = json.loads(path.read_bytes())["features"]
        published.extend(row["properties"]["id"] for row in restored)
        files.append({"path": name, "sha256": digest(content), "bytes": len(content),
                      "gzip_bytes": len(gzip.compress(content, compresslevel=9, mtime=0)), "count": len(part)})
    if set(published) != expected_ids or len(published) != len(expected_ids):
        raise ValueError(f"{town_id}: missing, extra or duplicate published IDs")
    return files


def process_town(town_id, boundary, cache, directory, snapshot):
    town = shapely.transform(shape(boundary["geometry"]), TO_METRES.transform, interleaved=False)
    if not town.is_valid or town.is_empty:
        raise ValueError(f"{town_id}: missing or invalid reference boundary")
    region = town.buffer(150, quad_segs=16)
    rows, pages = read_source(region.bounds, cache, town_id)
    features, reviews, selected, dates = [], [], set(), set()
    stats = Counter(dict.fromkeys(("total", "inside", "crossing", "nearby", "inside_known_year",
                                   "inside_unknown_year", "inside_30_plus", "registry_linked",
                                   "official_height", "estimated_height", "unknown_height"), 0))
    candidate_ids = Counter(row["properties"]["a1"] for row in rows)
    for row in rows:
        source, original = row["properties"], shape(row["geometry"])
        if not original.is_valid or original.geom_type not in ("Polygon", "MultiPolygon"):
            raise ValueError(f"{source['a1']}: invalid source polygon")
        if not region.intersects(original):
            continue
        if source["a1"] in selected:
            raise ValueError(f"{town_id}: duplicate building in the buffer: {source['a1']}")
        selected.add(source["a1"])
        dates.add(date.fromisoformat(source["a22"].removesuffix("Z")).isoformat())
        inside = True if town.covers(original) else None if town.intersects(original) else False
        properties = building_properties(source, inside, snapshot)
        geometry = output_geometry(original, source["a1"], reviews)
        features.append({"type": "Feature", "properties": properties, "geometry": geometry})
        stats["total"] += 1
        stats[{True: "inside", False: "nearby", None: "crossing"}[inside]] += 1
        stats["registry_linked"] += bool(source["a19"])
        stats[{"official": "official_height", "estimated_from_floors": "estimated_height",
               None: "unknown_height"}[properties["height_source"]]] += 1
        if inside:
            stats["inside_known_year" if properties["approval_year"] else "inside_unknown_year"] += 1
            stats["inside_30_plus"] += properties["age_tier"] == "30_plus"
    if len(dates) != 1 or not selected:
        raise ValueError(f"{town_id}: inconsistent source dates or no selected buildings")
    features.sort(key=lambda feature: feature["properties"]["id"])
    files = package(directory, town_id, features, selected)
    return {"source_as_of": dates.pop(), "files": files, "stats": dict(stats),
            "audit": {"bbox_count": len(rows), "wfs_pages": pages, "matched_unique_ids": len(selected),
                      "duplicate_ids_outside_buffer": sorted(k for k,n in candidate_ids.items()
                                                             if n > 1 and k not in selected),
                      "matched_ids_sha256": digest("\n".join(sorted(selected)).encode()),
                      "rounded_geometry_reviews": reviews}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=ROOT / "moatown-data" / "latest.json")
    parser.add_argument("--output", type=Path, default=ROOT / "moatown-data" / "buildings")
    parser.add_argument("--cache-dir", type=Path)
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_bytes())
    boundary_path = args.manifest.parent / manifest["files"]["boundaries"]
    boundaries = {f["properties"]["entity_id"]: f for f in json.loads(boundary_path.read_bytes())["features"]
                  if f["properties"]["entity_type"] == "town"}
    if args.cache_dir:
        args.cache_dir.mkdir(parents=True, exist_ok=True)
    snapshot = date.fromisoformat(manifest["snapshot_date"])
    args.output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=args.output.parent) as workspace:
        stage = Path(workspace)
        towns = {tid: process_town(tid, boundaries[tid], args.cache_dir, stage, snapshot) for tid in TOWN_IDS}
        dates = {town["source_as_of"] for town in towns.values()}
        checks = [datetime.fromisoformat(page["timestamp"]).astimezone(timezone(timedelta(hours=9))).date()
                  for town in towns.values() for page in town["audit"]["wfs_pages"]]
        index = {
            "dataset": "국토교통부 GIS건물통합정보 (서울시 부동산정보광장)",
            "source_url": MAP_URL, "wfs_url": WFS, "layer": LAYER,
            "catalog_url": "https://www.data.go.kr/data/15083092/fileData.do",
            "column_dictionary_url": "https://www.vworld.kr/contents/국가중점데이터_컬럼정의서_배포용.xlsx",
            "license": "공공누리 제1유형 (출처표시)",
            "license_url": "https://www.kogl.or.kr/info/licenseType1.do",
            "source_as_of": next(iter(dates)) if len(dates) == 1 else None,
            "checked_on": max(checks).isoformat(), "snapshot_date": snapshot.isoformat(),
            "boundary_sha256": digest(boundary_path.read_bytes()), "buffer_m": 150,
            "source_fields": FIELDS, "source_crs": "EPSG:5179", "output_crs": "OGC:CRS84",
            "geometry_source": "연속지적도 기반 건물 도형과 세움터 대장을 건물 단위로 통합. 위치는 원자료의 작성 정확도를 따릅니다.",
            "towns": towns,
        }
        index_name = "index.json"
        (stage / index_name).write_bytes(json.dumps(index, ensure_ascii=False, indent=2).encode() + b"\n")
        for town in towns.values():
            for file in town["files"]:
                (stage / file["path"]).replace(args.output / file["path"])
        (stage / index_name).replace(args.output / index_name)


if __name__ == "__main__":
    main()
