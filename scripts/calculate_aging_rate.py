"""Rebuild 20/30-year reference rates using the pinned GIS building files.

Run with uv run --with geopandas python scripts/calculate_aging_rate.py.
The town inclusion flag was calculated against the original (unrounded) geometry.
For child zones, join the published building footprints to their reference polygon.
"""
import argparse
import hashlib
import json
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

import geopandas as gpd
from shapely.geometry import shape

ROOT = Path(__file__).resolve().parents[1] / "moatown-data"


def read(path):
    return json.loads(path.read_bytes())


def percentage(part, total):
    return float((Decimal(part) * 100 / total).quantize(Decimal(".1"), rounding=ROUND_HALF_UP))


def metrics(years, year):
    values = [v for v in years if isinstance(v, int) and 0 < v <= year]
    count20 = sum(year - v >= 20 for v in values)
    count30 = sum(year - v >= 30 for v in values)
    return {"total": len(years), "known": len(values), "unknown": len(years)-len(values),
            "over_20": count20, "over_30": count30,
            "rate_20": percentage(count20, len(years)) if values else None,
            "rate_30": percentage(count30, len(years)) if values else None}


def update(root, check=False):
    manifest = read(root / "latest.json")
    files = manifest["files"]
    year = int(manifest["snapshot_date"][:4])
    index_path = root / files["buildings"]
    index = read(index_path)
    boundary_bytes = (root / files["boundaries"]).read_bytes().replace(b"\r\n", b"\n")
    if hashlib.sha256(boundary_bytes).hexdigest() != index["boundary_sha256"]:
        raise ValueError("Rebuild town/building inclusion flags for the new reference boundaries")
    boundaries = {f["properties"]["entity_id"]: shape(f["geometry"])
                  for f in read(root / files["boundaries"])["features"]}
    towns, zones = (read(root / files[k]) for k in ("towns", "zones"))
    stats = {}
    registry = read(root / files["registry_heights"])["records"]
    for town_id, entry in index["towns"].items():
        buildings = []
        ids = set()
        for chunk in entry["files"]:
            raw = (index_path.parent / chunk["path"]).read_bytes().replace(b"\r\n", b"\n")
            if hashlib.sha256(raw).hexdigest() != chunk["sha256"]:
                raise ValueError(f"Building checksum mismatch: {chunk['path']}")
            for feature in json.loads(raw)["features"]:
                p = feature["properties"]
                if p["id"] in ids:
                    raise ValueError(f"Duplicate building {p['id']} in {town_id}")
                ids.add(p["id"])
                approval = p.get("approval_year")
                if approval is None and registry.get(p["id"], {}).get("approval_date"):
                    approval = int(registry[p["id"]]["approval_date"][:4])
                buildings.append((approval, p["is_inside_town"], feature))
        stats[town_id] = metrics([v for v, inside, _ in buildings if inside is True], year)
        if stats[town_id]["total"] != entry["stats"]["inside"]:
            raise ValueError(f"Building denominator mismatch: {town_id}")
        children = [z["id"] for z in zones if z["town_id"] == town_id and z["id"] in boundaries]
        if not children:
            continue
        # A child extending past the 150 m extraction area would yield a partial denominator.
        extent = gpd.GeoSeries([boundaries[town_id]], crs=4326).to_crs(5179).iloc[0].buffer(index["buffer_m"])
        child_frame = gpd.GeoDataFrame({"zone": children}, geometry=[boundaries[z] for z in children], crs=4326)
        child_frame = child_frame[child_frame.to_crs(5179).geometry.covered_by(extent)]
        footprints = gpd.GeoDataFrame(geometry=[shape(f["geometry"]) for _, _, f in buildings], crs=4326)
        matches = footprints.sjoin(child_frame, predicate="covered_by")
        for child in child_frame.zone:
            stats[child] = metrics([buildings[i][0] for i in matches.index[matches.zone == child]], year)
    for key, rows in [("towns", towns), ("zones", zones)]:
        path = root / files[key]
        for row in rows:
            s = stats.get(row["id"])
            row["aging_rate"] = s["rate_30"] if s else None
            row["aging_criteria"] = (f"{year}년 기준 사용승인 후 30년 이상으로 확인된 동수 ÷ 참고 경계 내부 전체 수록 동수"
                                     if s else None)
            row["aging_reference"] = ({**s, "year": year, "source_url": index["catalog_url"],
                                       "source_as_of": index["source_as_of"], "checked_on": manifest["snapshot_date"],
                                       "evidence": "registered_buildings_inside_reference_boundary",
                                       "registry_supplement": files["registry_heights"]} if s else None)
        if check:
            if rows != read(path):
                raise ValueError(f"Stale aging data: {path}")
        else:
            temp = path.with_suffix(".json.tmp")
            temp.write_text(json.dumps(rows, ensure_ascii=False, indent=2)+"\n", encoding="utf8", newline="\n")
            temp.replace(path)
        print(key, sum(row["aging_rate"] is not None for row in rows), "/", len(rows))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    update(ROOT, args.check)
