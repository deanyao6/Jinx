"""The merged venue set, shared by build_seed_sql.py and fill_elevations.py.

Venues come from three files (seed/nfl_venues.json, seed/mlb_venues.generated.json and the hand
overrides), merged so a building two leagues share is one row. Both scripts need exactly the same
keys and coordinates, so the merge lives here once.

Elevations live in seed/venue_elevations.json, keyed by the merged venue key, rather than in the
venue files: mlb_venues.generated.json is regenerated from the MLB Stats API by gen_mlb_seeds.py
and would lose a column written into it.
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SEED = os.path.join(ROOT, "seed")
ELEVATIONS = os.path.join(SEED, "venue_elevations.json")


def load(name):
    with open(os.path.join(SEED, name), encoding="utf8") as f:
        return json.load(f)


def slug(s):
    out = []
    for ch in s.lower():
        if ch.isalnum():
            out.append(ch)
        elif out and out[-1] != "-":
            out.append("-")
    return "".join(out).strip("-")


def merged_venues():
    """key -> venue record, exactly as supabase/seed.sql writes them."""
    nfl = {v["key"]: v for v in load("nfl_venues.json")}
    overrides = load("mlb_venue_overrides.json")
    merge_by_name = overrides["merge_into_nfl_by_name"]
    coords_by_name = overrides["coordinates_by_name"]
    closed_by_name = overrides["closed_years_by_name"]

    venues = {}
    for k, v in nfl.items():
        venues[k] = {
            "key": k, "name": v["name"], "city": v.get("city"), "state": v.get("state"), "country": v.get("country"),
            "lat": v.get("lat"), "lng": v.get("lng"), "geofence_m": v.get("geofence_m", 400),
            "opened_year": v.get("opened_year"), "closed_year": v.get("closed_year"), "tz": None,
            "provider_ids": {"nflverse_stadium_ids": v["provider_ids"].get("nflverse_stadium_ids", [])},
            "sports": set(v.get("sports", ["nfl"])), "aliases": set(v.get("aliases", [])) | {v["name"]},
        }

    for v in load("mlb_venues.generated.json"):
        if v["name"] == "TBD":
            continue
        names = set(v["aliases"]) | {v["name"]}
        target = None
        for n in names:
            if n in merge_by_name:
                target = merge_by_name[n]
        if target and target in venues:
            rec = venues[target]
            rec["provider_ids"]["mlb_venue_id"] = v["provider_ids"]["mlb_venue_id"]
            rec["sports"].add("mlb")
            rec["aliases"] |= names
            rec["tz"] = rec["tz"] or v.get("tz")
            continue
        key = "mlb-" + slug(v["name"]) if v["name"] else v["key"]
        if key in venues:  # two MLB venue ids with the same name (e.g. Yankee Stadium I vs II are distinct names; guard anyway)
            key = v["key"]
        rec = {
            "key": key, "name": v["name"], "city": v.get("city"), "state": v.get("state"), "country": v.get("country"),
            "lat": v.get("lat"), "lng": v.get("lng"), "geofence_m": v.get("geofence_m", 400),
            "opened_year": None, "closed_year": None, "tz": v.get("tz"),
            "provider_ids": {"mlb_venue_id": v["provider_ids"]["mlb_venue_id"]},
            "sports": {"mlb"}, "aliases": names,
        }
        for n in names:
            if n in coords_by_name:
                c = coords_by_name[n]
                rec["lat"], rec["lng"] = c["lat"], c["lng"]
                rec["city"] = c.get("city") or rec["city"]; rec["state"] = c.get("state", rec["state"])
                rec["opened_year"] = c.get("opened_year"); rec["closed_year"] = c.get("closed_year")
            if n in closed_by_name:
                rec["closed_year"] = closed_by_name[n]
        if rec["closed_year"] is None and v["last_season"] < 2024 and rec["opened_year"] is None:
            # Venue not used by MLB since before last season; mark closed for stamp styling unless we know better.
            rec["closed_year"] = v["last_season"]
        venues[key] = rec
    return venues


def load_elevations():
    """key -> elevation in whole feet, for venues fill_elevations.py has resolved."""
    if not os.path.exists(ELEVATIONS):
        return {}
    with open(ELEVATIONS, encoding="utf8") as f:
        data = json.load(f)
    return {k: v["elevation_ft"] for k, v in data["venues"].items() if v.get("elevation_ft") is not None}
