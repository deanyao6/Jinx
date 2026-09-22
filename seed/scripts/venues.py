"""The merged venue set, shared by build_seed_sql.py and fill_elevations.py.

Venues come from four files (seed/nfl_venues.json, seed/mlb_venues.generated.json, the hand
overrides and seed/nba_venues.json), merged so a building two leagues share is one row. Both
scripts need exactly the same keys and coordinates, so the merge lives here once.

Elevations live in seed/venue_elevations.json and timezones in seed/venue_timezones.json, both
keyed by the merged venue key, rather than in the venue files: mlb_venues.generated.json is
regenerated from the MLB Stats API by gen_mlb_seeds.py and would lose a column written into it.
Only the MLB file carries its own `tz`; the NFL and NBA ones have none, which is why
fill_timezones.py resolves every venue from its coordinates.
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SEED = os.path.join(ROOT, "seed")
ELEVATIONS = os.path.join(SEED, "venue_elevations.json")
TIMEZONES = os.path.join(SEED, "venue_timezones.json")


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

    # NBA arenas. The Alamodome is the one building the NFL seed already has: it gains the sport
    # and the ESPN id rather than a second row.
    for v in load("nba_venues.json")["venues"]:
        k = v["key"]
        if k in venues:
            rec = venues[k]
            rec["sports"].add("nba")
            rec["aliases"] |= set(v.get("aliases", [])) | {v["name"]}
            rec["provider_ids"]["espn_venue_ids"] = v["provider_ids"].get("espn_venue_ids", [])
            continue
        venues[k] = {
            "key": k, "name": v["name"], "city": v.get("city"), "state": v.get("state"), "country": v.get("country"),
            "lat": v.get("lat"), "lng": v.get("lng"), "geofence_m": v.get("geofence_m", 250),
            "opened_year": v.get("opened_year"), "closed_year": v.get("closed_year"), "tz": None,
            "provider_ids": {"espn_venue_ids": v["provider_ids"].get("espn_venue_ids", [])},
            "sports": set(v.get("sports", ["nba"])), "aliases": set(v.get("aliases", [])) | {v["name"]},
        }
    # MLS stadiums shared with another league must retain the existing key and coordinates.
    for v in load("mls_venues.json")["venues"]:
        names = set(v.get("aliases", [])) | {v["name"]}
        target = v.get("merge_into")
        if not target:
            matches = [k for k, old in venues.items() if {n.lower() for n in names} & {n.lower() for n in old["aliases"]}]
            if len(matches) > 1:
                raise ValueError(f"Ambiguous MLS venue {v['name']}: {matches}; set merge_into")
            target = matches[0] if matches else None
        if target:
            rec = venues[target]
            rec["sports"].add("mls")
            rec["aliases"] |= names
            rec["provider_ids"]["espn_venue_ids"] = sorted(set(rec["provider_ids"].get("espn_venue_ids", [])) | set(v["provider_ids"]["espn_venue_ids"]))
        else:
            venues[v["key"]] = {
                **v, "tz": v.get("tz"), "opened_year": v.get("opened_year"), "closed_year": v.get("closed_year"),
                "sports": set(v["sports"]), "aliases": names,
            }
    # The resolved zones, for any venue whose own seed file carries none.
    for key, tz in load_timezones().items():
        if key in venues and not venues[key].get("tz"):
            venues[key]["tz"] = tz
    return venues


def load_elevations():
    """key -> elevation in whole feet, for venues fill_elevations.py has resolved."""
    if not os.path.exists(ELEVATIONS):
        return {}
    with open(ELEVATIONS, encoding="utf8") as f:
        data = json.load(f)
    return {k: v["elevation_ft"] for k, v in data["venues"].items() if v.get("elevation_ft") is not None}


def load_timezones():
    """key -> IANA zone, for venues fill_timezones.py has resolved from their coordinates."""
    if not os.path.exists(TIMEZONES):
        return {}
    with open(TIMEZONES, encoding="utf8") as f:
        data = json.load(f)
    return {k: v["tz"] for k, v in data.items() if v.get("tz")}
