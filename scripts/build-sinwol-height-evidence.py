# /// script
# requires-python = ">=3.11"
# dependencies = ["shapely==2.2.0", "pyproj==3.7.2"]
# ///
"""Resolve missing Sinwol building floors. Run with uv run scripts/build-sinwol-height-evidence.py."""

import json
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

import shapely
from pyproj import Transformer
from shapely.geometry import shape


ROOT = Path(__file__).resolve().parents[1] / "moatown-data" / "buildings"
TOWN = "mt-202603-public-067"
MAP = "https://land.seoul.go.kr/land/map/land/map.do"
WFS = "https://land.seoul.go.kr/land/geoserver/wfs.do"
TO_METRES = Transformer.from_crs(4326, 5179, always_xy=True)
NRM = "landbiz:tl_nrm_buld"
ROAD = "landbiz:tl_sdw_buld"


def fetch(layer, fields, bounds):
    """Use a stable unique feature key for paging, and request building attributes only."""
    key, *_ = fields
    names = "".join(f"<wfs:PropertyName>{v}</wfs:PropertyName>" for v in (*fields, "geom"))
    west, south, east, north = bounds
    rows, dates = [], set()
    total = None
    while total is None or len(rows) < total:
        xml = f"""<wfs:GetFeature xmlns:wfs="http://www.opengis.net/wfs"
            xmlns:ogc="http://www.opengis.net/ogc" xmlns:gml="http://www.opengis.net/gml"
            version="1.1.0" service="WFS" outputFormat="application/json"
            maxFeatures="1000" startIndex="{len(rows)}"><wfs:Query typeName="{layer}" srsName="EPSG:5179">
            {names}<ogc:Filter><ogc:BBOX><ogc:PropertyName>geom</ogc:PropertyName>
            <gml:Envelope srsName="EPSG:5179"><gml:lowerCorner>{west} {south}</gml:lowerCorner>
            <gml:upperCorner>{east} {north}</gml:upperCorner></gml:Envelope></ogc:BBOX></ogc:Filter>
            <ogc:SortBy><ogc:SortProperty><ogc:PropertyName>{key}</ogc:PropertyName>
            <ogc:SortOrder>ASC</ogc:SortOrder></ogc:SortProperty></ogc:SortBy></wfs:Query></wfs:GetFeature>"""
        request = Request(WFS, data=urlencode({"body": quote(xml, safe="")}).encode(), headers={"Referer": MAP})
        with urlopen(request, timeout=60) as response:
            page = json.load(response)
        if total is None:
            total = page["numberMatched"]
        batch = page["features"]
        if (page["numberMatched"] != total or not batch or len(batch) != page["numberReturned"] or
                not page["crs"]["properties"]["name"].endswith("::5179")):
            raise ValueError(f"Incomplete or inconsistent WFS response for {layer}")
        rows.extend(batch)
        local_date = datetime.fromisoformat(page["timeStamp"]).astimezone(timezone(timedelta(hours=9))).date()
        dates.add(local_date.isoformat())
    ids = {r["properties"][key] for r in rows}
    if len(rows) != total or len(ids) != total or None in ids or len(dates) != 1:
        raise ValueError(f"Missing/duplicate keys or changing source date for {layer}")
    return rows, dates.pop()


def overlaps(published, rows):
    """Index every meaningful competing footprint, including buildings with known floor counts."""
    geometry = [shape(row["geometry"]) for row in rows]
    index = shapely.STRtree(geometry)
    pairs = [[] for _ in published]
    candidates = Counter()
    for i, g in enumerate(published):
        for j in index.query(g):
            other = geometry[j]
            if not other.is_valid:
                # Invalid geometry can block an ambiguous match but cannot supply a value.
                if g.intersects(shapely.make_valid(other)):
                    pairs[i].append((j, 0.0, False))
                continue
            area = g.intersection(other).area
            iou = area / (g.area + other.area - area)
            if iou > 0.1:
                pairs[i].append((j, iou, True))
                candidates[j] += 1
    return pairs, candidates


def main():
    features = json.loads((ROOT / f"{TOWN}.geojson").read_bytes())["features"]
    published = [shapely.transform(shape(f["geometry"]), TO_METRES.transform, interleaved=False) for f in features]
    bounds = shapely.total_bounds(published)
    bounds += [-10, -10, 10, 10]  # Keep every source footprint intersecting the rounded published geometries.
    topo, checked = fetch(NRM, ("ufid", "flr_num", "h_date"), bounds)
    road, road_checked = fetch(ROAD, ("bd_mgt_sn", "gro_flo_co"), bounds)
    if road_checked != checked:
        raise ValueError("The two layers were checked on different dates")
    matches, reverse = overlaps(published, topo)
    street_matches, _ = overlaps(published, road)
    records = {}
    missing = 0
    for i, feature in enumerate(features):
        props = feature["properties"]
        if props["height_m"] is not None or props["floors"] is not None:
            continue
        missing += 1
        if len(matches[i]) != 1:
            continue
        j, iou, valid = matches[i][0]
        if not valid or iou < 0.9 or reverse[j] != 1:
            continue
        row = topo[j]["properties"]
        floor_text = str(row["flr_num"])
        if not floor_text.isdigit() or int(floor_text) < 1:
            continue
        floors = int(floor_text)
        # A substantial second source with a different count makes the floor evidence ambiguous.
        if any(road[k]["properties"]["gro_flo_co"] not in (None, 0, floors)
               for k, road_iou, usable in street_matches[i] if usable and road_iou >= 0.6):
            continue
        records[props["id"]] = {
            "floors": floors, "height_m": floors * 3, "height_source": "estimated_from_floors",
            "source_url": MAP, "source_layer": NRM, "source_field": "flr_num", "source_id": row["ufid"],
            "source_as_of": None, "source_record_date": date.fromisoformat(row["h_date"]).isoformat() if row["h_date"] else None,
            "method": "unique_footprint_iou", "overlap_iou": round(iou, 4),
        }
    evidence = {
        "town_id": TOWN, "source": "서울특별시 서울부동산정보광장 건물 지도",
        "source_url": MAP, "wfs_url": WFS, "source_as_of": None, "checked_on": checked,
        "date_note": "source_record_date는 원천 도형의 h_date이다. 지도 전체의 기준일은 확인되지 않았다.",
        "method_note": "EPSG:5179에서 두 건물 도형의 교집합 면적을 합집합 면적으로 나눈 값(IoU)이 0.9 이상이어야 한다. 양방향에서 IoU 0.1 초과 후보가 하나여야 하며 도로명주소 건물(gro_flo_co, IoU 0.6 이상)과 층수가 다르면 보류한다. 지도 층수에 3m를 곱한 추정 높이다.",
        "coverage": {"originally_missing": missing, "matched": len(records), "still_missing": missing - len(records)},
        "records": records,
    }
    out = ROOT / "sinwol-height-evidence.json"
    with TemporaryDirectory(dir=ROOT) as staging:
        tmp = Path(staging) / out.name
        tmp.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
        tmp.replace(out)
    print(json.dumps(evidence["coverage"]))


if __name__ == "__main__":
    main()
