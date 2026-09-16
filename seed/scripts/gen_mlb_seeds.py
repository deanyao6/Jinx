#!/usr/bin/env python3
"""Generate seed/mlb_teams.json and seed/mlb_venues.json from the MLB Stats API.

Unions teams and venues across seasons 2000..current so relocated/renamed franchises
(Expos -> Nationals, Devil Rays -> Rays, Florida -> Miami Marlins, Indians -> Guardians,
Anaheim Angels -> Los Angeles Angels of Anaheim -> Los Angeles Angels) and former venues
are all captured. MLB team ids are stable across those changes and serve as franchise ids.
Run: python3 seed/scripts/gen_mlb_seeds.py
"""
import json, sys, time, urllib.request, datetime

BASE = "https://statsapi.mlb.com/api/v1"
FIRST_SEASON = 2000
LAST_SEASON = datetime.date.today().year

def get(url):
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001
            time.sleep(1 + attempt)
            err = e
    raise err

teams = {}      # id -> record
venues = {}     # id -> record
for season in range(FIRST_SEASON, LAST_SEASON + 1):
    t = get(f"{BASE}/teams?sportId=1&season={season}")
    for x in t.get("teams", []):
        rec = teams.setdefault(x["id"], {
            "provider": "mlb", "provider_team_id": str(x["id"]), "franchise_id": f"mlb-{x['id']}",
            "sport": "mlb", "names": {}, "abbreviations": set(), "home_venue_ids_by_season": {},
        })
        rec["names"][str(season)] = {
            "name": x.get("name"), "team_name": x.get("teamName"), "location": x.get("locationName"),
            "abbreviation": x.get("abbreviation"), "short_name": x.get("shortName"),
            "franchise_name": x.get("franchiseName"), "club_name": x.get("clubName"),
        }
        if x.get("abbreviation"):
            rec["abbreviations"].add(x["abbreviation"])
        if x.get("venue"):
            rec["home_venue_ids_by_season"][str(season)] = x["venue"]["id"]
        rec["active"] = bool(x.get("active", True))
        rec["league"] = (x.get("league") or {}).get("name")
        rec["division"] = (x.get("division") or {}).get("name")
    v = get(f"{BASE}/venues?sportId=1&season={season}&hydrate=location,timezone")
    for x in v.get("venues", []):
        loc = x.get("location") or {}
        coords = loc.get("defaultCoordinates") or {}
        rec = venues.setdefault(x["id"], {
            "provider_ids": {"mlb_venue_id": x["id"]}, "names": {}, "seasons": [],
        })
        rec["names"][str(season)] = x.get("name")
        rec["seasons"].append(season)
        if coords.get("latitude") is not None:
            rec["lat"] = coords["latitude"]; rec["lng"] = coords["longitude"]
        if loc.get("city"):
            rec["city"] = loc.get("city"); rec["state"] = loc.get("stateAbbrev"); rec["country"] = loc.get("country")
        if x.get("timeZone"):
            rec["tz"] = x["timeZone"].get("id")
    print(f"season {season}: {len(t.get('teams', []))} teams, {len(v.get('venues', []))} venues", file=sys.stderr)
    time.sleep(0.25)

def latest(d):
    return d[max(d.keys())]

team_out = []
for tid, r in sorted(teams.items()):
    cur = latest(r["names"])
    aliases = set()
    for n in r["names"].values():
        for k in ("name", "team_name", "location", "abbreviation", "short_name", "franchise_name", "club_name"):
            if n.get(k):
                aliases.add(n[k])
    team_out.append({
        "provider": "mlb", "provider_team_id": r["provider_team_id"], "franchise_id": r["franchise_id"],
        "sport": "mlb", "name": cur["name"], "team_name": cur["team_name"], "city": cur["location"],
        "abbreviation": cur["abbreviation"], "active": r.get("active", True),
        "league": r.get("league"), "division": r.get("division"),
        "historical_names": sorted({n["name"] for n in r["names"].values() if n.get("name")}),
        "aliases": sorted(aliases), "home_venue_ids_by_season": r["home_venue_ids_by_season"],
        "first_season_in_range": min(int(s) for s in r["names"]), "last_season_in_range": max(int(s) for s in r["names"]),
    })

venue_out = []
for vid, r in sorted(venues.items()):
    names = r["names"]
    venue_out.append({
        "key": f"mlb-venue-{vid}", "provider_ids": r["provider_ids"], "name": latest(names),
        "aliases": sorted(set(names.values())), "city": r.get("city"), "state": r.get("state"), "country": r.get("country"),
        "lat": r.get("lat"), "lng": r.get("lng"), "tz": r.get("tz"),
        "first_season": min(r["seasons"]), "last_season": max(r["seasons"]), "sports": ["mlb"],
        "geofence_m": 400,
    })

json.dump(team_out, open("seed/mlb_teams.generated.json", "w"), indent=1, ensure_ascii=False)
json.dump(venue_out, open("seed/mlb_venues.generated.json", "w"), indent=1, ensure_ascii=False)
print(f"wrote {len(team_out)} teams, {len(venue_out)} venues", file=sys.stderr)
