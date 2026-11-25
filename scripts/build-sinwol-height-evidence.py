# /// script
# requires-python = ">=3.11"
# dependencies = ["shapely==2.2.0", "pyproj==3.7.2"]
# ///
"""Check missing building floors, defaulting to Sinwol.

Use --all --prefetch --cache-dir PATH to collect Seoul WFS pages for the reference
boundaries before a building build. Use --all --cache-dir PATH to resume and match
the final published footprints. Use a new cache directory for a new source check.
"""

import argparse
import json
import math
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta, timezone
from hashlib import sha256
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.error import URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

import shapely
from pyproj import Transformer
from shapely.geometry import shape


ROOT = Path(__file__).resolve().parents[1] / "moatown-data" / "buildings"
TOWNS = {"sinwol": "mt-202603-public-067", "beon": "mt-202603-public-034", "myeonmok": "mt-202603-public-010"}
MAP = "https://land.seoul.go.kr/land/map/land/map.do"
WFS = "https://land.seoul.go.kr/land/geoserver/wfs.do"
TO_METRES = Transformer.from_crs(4326, 5179, always_xy=True)
NRM = "landbiz:tl_nrm_buld"
ROAD = "landbiz:tl_sdw_buld"
UNITY = "landbiz:tl_unity_buld"


def atomic_write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(dir=path.parent) as staging:
        tmp = Path(staging) / path.name
        tmp.write_bytes(data)
        tmp.replace(path)


def fetch(layer, fields, bounds, cache, source_id=None):
    """Page by source identifier and check completeness against distinct WFS row identifiers."""
    key, *_ = fields
    names = "".join(f"<wfs:PropertyName>{v}</wfs:PropertyName>" for v in (*fields, "geom"))
    if source_id is None:
        west, south, east, north = bounds
        predicate = f"""<ogc:BBOX><ogc:PropertyName>geom</ogc:PropertyName>
            <gml:Envelope srsName="EPSG:5179"><gml:lowerCorner>{west} {south}</gml:lowerCorner>
            <gml:upperCorner>{east} {north}</gml:upperCorner></gml:Envelope></ogc:BBOX>"""
    else:
        if not source_id.isascii() or not source_id.isdigit():
            raise ValueError(f"Invalid road building identifier: {source_id!r}")
        predicate = f"<ogc:PropertyIsEqualTo><ogc:PropertyName>{key}</ogc:PropertyName><ogc:Literal>{source_id}</ogc:Literal></ogc:PropertyIsEqualTo>"
    rows, dates, page_hashes = [], set(), []
    total = None
    while total is None or len(rows) < total:
        xml = f"""<wfs:GetFeature xmlns:wfs="http://www.opengis.net/wfs"
            xmlns:ogc="http://www.opengis.net/ogc" xmlns:gml="http://www.opengis.net/gml"
            version="1.1.0" service="WFS" outputFormat="application/json"
            maxFeatures="1000" startIndex="{len(rows)}"><wfs:Query typeName="{layer}" srsName="EPSG:5179">
            {names}<ogc:Filter>{predicate}</ogc:Filter>
            <ogc:SortBy><ogc:SortProperty><ogc:PropertyName>{key}</ogc:PropertyName>
            <ogc:SortOrder>ASC</ogc:SortOrder></ogc:SortProperty></ogc:SortBy></wfs:Query></wfs:GetFeature>"""
        cached = cache / (sha256((WFS + xml).encode()).hexdigest() + ".json") if cache else None
        if cached and cached.exists():
            raw = cached.read_bytes()
        else:
            request = Request(WFS, data=urlencode({"body": quote(xml, safe="")}).encode(), headers={"Referer": MAP})
            for attempt in range(3):
                try:
                    with urlopen(request, timeout=60) as response:
                        raw = response.read()
                    break
                except (URLError, TimeoutError, ConnectionError):
                    if attempt == 2:
                        raise
                    time.sleep(2 ** attempt)
        page = json.loads(raw)
        if total is None:
            total = page["numberMatched"]
        batch = page["features"]
        if (page["numberMatched"] != total or (not batch and total) or len(batch) != page["numberReturned"] or
                not page["crs"]["properties"]["name"].endswith("::5179")):
            raise ValueError(f"Incomplete or inconsistent WFS response for {layer}")
        if cached and not cached.exists():
            atomic_write(cached, raw)
        page_hashes.append(sha256(raw).hexdigest())
        rows.extend(batch)
        local_date = datetime.fromisoformat(page["timeStamp"]).astimezone(timezone(timedelta(hours=9))).date()
        dates.add(local_date.isoformat())
    ids = {r["id"] for r in rows}
    if len(rows) != total or len(ids) != total or not all(ids) or len(dates) != 1:
        raise ValueError(f"Missing/duplicate WFS rows or changing source date for {layer}")
    return rows, dates.pop(), page_hashes


def overlaps(g, index):
    """Find every meaningful competing footprint, including rows without a floor count."""
    pairs = []
    for j in index.query(g):
        other = index.geometries[j]
        if not other.is_valid:
            if g.intersects(shapely.make_valid(other)):
                pairs.append((j, 0.0))
            continue
        area = g.intersection(other).area
        iou = area / (g.area + other.area - area)
        if iou > 0.1:
            pairs.append((j, iou))
    return pairs


def geometry_index(rows):
    return shapely.STRtree([shape(row["geometry"]) for row in rows])


def floor_count(value):
    text = str(value)
    return int(text) if text.isdigit() and int(text) > 0 else None


def verify_road_candidate(published_id, road_row, cache, checked):
    """Check source ID citywide, obtain its record date and check raw GIS neighbors beyond the display buffer."""
    props = road_row["properties"]
    source_id = props["bd_mgt_sn"]
    rows, road_date, road_hashes = fetch(ROAD, ("bd_mgt_sn", "gro_flo_co", "opert_de", "mvmn_de"),
                                        None, cache, source_id)
    if road_date != checked:
        raise ValueError(f"{source_id}: date of road record lookup differs from the footprint snapshot")
    if len(rows) != 1:
        return None
    row = rows[0]
    if (row["id"] != road_row["id"] or row["geometry"] != road_row["geometry"] or
            any(row["properties"][key] != props[key] for key in ("bd_mgt_sn", "gro_flo_co"))):
        raise ValueError(f"{source_id}: road feature changed between queries")
    footprint = shape(row["geometry"])
    w, s, e, n = footprint.bounds
    bounds = [math.floor(w), math.floor(s), math.ceil(e), math.ceil(n)]
    neighbors, unity_date, unity_hashes = fetch(UNITY, ("a1", "a16", "a26"), bounds, cache)
    if unity_date != checked:
        raise ValueError(f"{source_id}: date of neighboring GIS footprint lookup differs from the road check")
    reverse = overlaps(footprint, geometry_index(neighbors))
    if len(reverse) != 1 or reverse[0][1] <= 0.9:
        return None
    gis = neighbors[reverse[0][0]]["properties"]
    if (gis["a1"] != published_id or any(float(gis[key] or 0) > 0 for key in ("a16", "a26")) or
            sum(r["properties"]["a1"] == published_id for r in neighbors) != 1):
        return None
    date_field = next((k for k in ("opert_de", "mvmn_de") if row["properties"][k]), None)
    raw_date = row["properties"][date_field][:8] if date_field else None
    record_date = date.fromisoformat(raw_date).isoformat() if raw_date else None
    return {"source_record_date": record_date, "source_date_field": date_field,
            "source_lookup_sha256": road_hashes, "gis_neighbors_sha256": unity_hashes}


def published_buildings(town_id, manifest):
    features = []
    for chunk in manifest["files"]:
        data = (ROOT / chunk["path"]).read_bytes()
        if sha256(data.replace(b"\r\n", b"\n")).hexdigest() != chunk["sha256"]:
            raise ValueError(f"Building chunk checksum mismatch: {chunk['path']}")
        features.extend(json.loads(data)["features"])
    if len(features) != manifest["stats"]["total"] or len({f["properties"]["id"] for f in features}) != len(features):
        raise ValueError(f"Incomplete or duplicate published buildings for {town_id}")
    return features


def process(town_id, boundary, manifest, cache, prefetch, resume):
    town = shapely.transform(shape(boundary["geometry"]), TO_METRES.transform, interleaved=False)
    west, south, east, north = town.bounds
    # 150 m display buffer plus room for whole building footprints that cross it.
    bounds = [math.floor(west - 250), math.floor(south - 250), math.ceil(east + 250), math.ceil(north + 250)]
    if not prefetch:
        features = published_buildings(town_id, manifest)
        published = [shapely.transform(shape(f["geometry"]), TO_METRES.transform, interleaved=False) for f in features]
        west, south, east, north = shapely.total_bounds(published)
        bounds = [min(bounds[0], math.floor(west - 10)), min(bounds[1], math.floor(south - 10)),
                  max(bounds[2], math.ceil(east + 10)), max(bounds[3], math.ceil(north + 10))]
    topo, checked, topo_pages = fetch(NRM, ("ufid", "flr_num", "h_date"), bounds, cache)
    road, road_checked, road_pages = fetch(ROAD, ("bd_mgt_sn", "gro_flo_co"), bounds, cache)
    if road_checked != checked:
        raise ValueError("The two layers were checked on different dates")
    if prefetch:
        return {"topographic": len(topo), "road": len(road), "checked_on": checked}
    pilot = next((slug for slug, tid in TOWNS.items() if tid == town_id), None)
    out = ROOT / f"{pilot}-height-evidence.json" if pilot else ROOT / "heights" / f"{town_id}.json"
    inputs = {"building_chunks": [chunk["sha256"] for chunk in manifest["files"]],
              "bbox_epsg_5179": bounds, "wfs_pages_sha256": {NRM: topo_pages, ROAD: road_pages}, "method_version": 1}
    # Keep a completed check in its WFS snapshot even when the town gained no road records.
    receipt = None
    if cache:
        signature = sha256(json.dumps({**inputs, "method_version": 2}, sort_keys=True).encode()).hexdigest()
        receipt = cache / f"{town_id}-{signature}.sha256"
        if resume and receipt.is_file() and out.is_file() and receipt.read_text() == sha256(out.read_bytes()).hexdigest():
            previous = json.loads(out.read_bytes())
            return previous["coverage"]
    published_index = shapely.STRtree(published)
    topo_index = geometry_index(topo)
    road_index = geometry_index(road)
    topo_ids = Counter(row["properties"]["ufid"] for row in topo)
    road_ids = Counter(row["properties"]["bd_mgt_sn"] for row in road)
    records = {}
    missing_by_area = Counter({"inside": 0, "crossing": 0, "nearby": 0})
    matched_by_area = missing_by_area.copy()
    for i, feature in enumerate(features):
        props = feature["properties"]
        if props["height_m"] is not None or props["floors"] is not None:
            continue
        area = {True: "inside", None: "crossing", False: "nearby"}[props["is_inside_town"]]
        missing_by_area[area] += 1
        topo_pairs = overlaps(published[i], topo_index)
        road_pairs = overlaps(published[i], road_index)
        source = None
        if len(topo_pairs) == 1:
            j, iou = topo_pairs[0]
            row = topo[j]["properties"]
            floors = floor_count(row["flr_num"])
            if (iou >= 0.9 and floors and row["ufid"] and topo_ids[row["ufid"]] == 1 and
                    len(overlaps(topo_index.geometries[j], published_index)) == 1 and
                    all(road[k]["properties"]["gro_flo_co"] in (None, 0, floors)
                        for k, road_iou in road_pairs if road_iou >= 0.6)):
                source = {"source_layer": NRM, "source_field": "flr_num", "source_id": row["ufid"],
                          "source_as_of": None, "source_record_date": date.fromisoformat(row["h_date"]).isoformat() if row["h_date"] else None}
        if source is None:
            if len(road_pairs) != 1 or len(topo_pairs) > 1:
                continue
            j, iou = road_pairs[0]
            row = road[j]["properties"]
            floors = floor_count(row["gro_flo_co"])
            if (iou <= 0.9 or not floors or not row["bd_mgt_sn"] or road_ids[row["bd_mgt_sn"]] != 1 or
                    len(overlaps(road_index.geometries[j], published_index)) != 1):
                continue
            if any(topo_iou == 0 or floor_count(topo[k]["properties"]["flr_num"]) not in (None, floors)
                   for k, topo_iou in topo_pairs):
                continue
            proof = verify_road_candidate(props["id"], road[j], cache, checked)
            if proof is None:
                continue
            source = {"source_layer": ROAD, "source_field": "gro_flo_co", "source_id": row["bd_mgt_sn"],
                      "source_as_of": None, **proof}
        records[props["id"]] = {
            "floors": floors, "height_m": floors * 3, "height_source": "estimated_from_floors",
            "source_url": MAP, **source,
            "method": "unique_footprint_iou", "overlap_iou": round(iou, 4),
        }
        matched_by_area[area] += 1
    missing = missing_by_area.total()
    if missing != manifest["stats"]["unknown_height"]:
        raise ValueError(f"{town_id}: missing height counts differ from the published manifest")
    evidence = {
        "town_id": town_id, "source": "서울특별시 서울부동산정보광장 건물 지도",
        "source_url": MAP, "wfs_url": WFS, "source_as_of": None, "checked_on": checked,
        "date_note": "source_record_date는 원천 도형의 h_date이다. 지도 전체의 기준일은 확인되지 않았다.",
        "method_note": "EPSG:5179에서 두 건물 도형의 교집합 면적을 합집합 면적으로 나눈 값(IoU)이 0.9 이상이어야 한다. 양방향에서 IoU 0.1 초과 후보가 하나여야 하며 도로명주소 건물(gro_flo_co, IoU 0.6 이상)과 층수가 다르면 보류한다. 지도 층수에 3m를 곱한 추정 높이다.",
        "coverage": {"originally_missing": missing, "matched": len(records), "still_missing": missing - len(records)},
        "records": records,
    }
    if any(record["source_layer"] == ROAD for record in records.values()):
        evidence["date_note"] = ("수치지형도 기록일은 h_date이다. 도로명주소 건물 기록일은 개별 레코드의 "
                                 "source_date_field에 표시한 작업일시(opert_de) 또는 이동일자(mvmn_de)이다. "
                                 "checked_on은 조회일이며 레이어 전체의 기준일은 확인되지 않았다.")
        evidence["method_note"] += (" 수치지형도로 보완되지 않은 건물은 도로명주소 지상층수(gro_flo_co)를 확인한다. "
                                    "IoU가 0.9를 초과하고 서울 전역에서 건물관리번호가 하나이며 도로명주소 도형과 대응하는 공개 도형 및 GIS 원본 도형도 각각 하나여야 한다. "
                                    "수치지형도에서 IoU 0.1 초과 후보가 여럿이거나 층수가 다르면 보류한다.")
        inputs["method_version"] = 2
    if not pilot:
        evidence["audit"] = {**inputs, "topographic_rows": len(topo), "road_rows": len(road),
                             "nonunique_source_ids": sorted(k for k, count in topo_ids.items() if k and count > 1),
                             "originally_missing_by_area": missing_by_area, "matched_by_area": matched_by_area}
    content = (json.dumps(evidence, ensure_ascii=False, indent=2) + "\n").encode()
    if not out.is_file() or out.read_bytes().replace(b"\r\n", b"\n") != content:
        atomic_write(out, content)
    if receipt:
        atomic_write(receipt, sha256(out.read_bytes()).hexdigest().encode())
    return evidence["coverage"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--town", help="Town ID or pilot alias (sinwol, beon, myeonmok)")
    group.add_argument("--all", action="store_true", help="Process every town with a reference boundary")
    parser.add_argument("--cache-dir", type=Path, help="External directory for replaying or resuming WFS pages")
    parser.add_argument("--entries-dir", type=Path, help="Read verified per-town manifest entries during a building build")
    parser.add_argument("--prefetch", action="store_true", help="Cache both layers before loading the published buildings")
    parser.add_argument("--resume", action="store_true", help="Reuse evidence with identical building chunks and WFS pages")
    parser.add_argument("--workers", type=int, choices=range(1, 5), default=2)
    args = parser.parse_args()
    if args.prefetch and not args.cache_dir:
        parser.error("--prefetch requires --cache-dir")
    latest = json.loads((ROOT.parent / "latest.json").read_bytes())
    boundary_file = ROOT.parent / latest["files"]["boundaries"]
    boundaries = {f["properties"]["entity_id"]: f for f in json.loads(boundary_file.read_bytes())["features"]
                  if f["properties"]["entity_type"] == "town"}
    manifests = {} if args.prefetch else json.loads((ROOT / "index.json").read_bytes())["towns"]
    if args.entries_dir and not args.prefetch:
        manifests.update({path.stem: json.loads(path.read_bytes()) for path in args.entries_dir.glob("*.json")})
    town = args.town or "sinwol"
    town_ids = sorted(boundaries) if args.all else [TOWNS.get(town, town)]
    missing = set(town_ids) - boundaries.keys()
    if missing:
        parser.error(f"Missing reference boundaries: {sorted(missing)}")
    if not args.prefetch and (missing := set(town_ids) - manifests.keys()):
        if not (args.entries_dir and args.all):
            parser.error(f"Missing published buildings for {len(missing)} towns; use --prefetch while building them")
        print(f"{len(missing)} town entries are pending. Checking {len(town_ids) - len(missing)} available towns.", flush=True)
        town_ids = [tid for tid in town_ids if tid in manifests]
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        jobs = {pool.submit(process, tid, boundaries[tid], manifests.get(tid), args.cache_dir, args.prefetch, args.resume): tid
                for tid in town_ids}
        errors = []
        for job in as_completed(jobs):
            tid = jobs[job]
            try:
                print(tid, json.dumps(job.result()), flush=True)
            except Exception as exc:
                errors.append(f"{tid}: {exc}")
                print(errors[-1], flush=True)
        if errors:
            raise SystemExit("\n".join(errors))


if __name__ == "__main__":
    main()
