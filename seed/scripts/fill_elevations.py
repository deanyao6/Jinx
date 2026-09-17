#!/usr/bin/env python3
"""Fill seed/venue_elevations.json: the ground elevation, in feet, of every seeded venue.

Feeds the "highest altitude game" superlative (venues.elevation_ft). Every number comes from a
live elevation service, never from memory:

  USA      USGS Elevation Point Query Service (3DEP), free, no key
           https://epqs.nationalmap.gov/v1/json?x=<lng>&y=<lat>&units=Feet&wkid=4326
  elsewhere  Open-Elevation (SRTM), free, no key, metres converted to feet
           https://api.open-elevation.com/api/v1/lookup?locations=<lat>,<lng>

Resumable: a venue already in the file with the same coordinates is skipped, and the file is
rewritten after every answer, so an interrupted run loses nothing. About two requests a second.

  python3 seed/scripts/fill_elevations.py            # resolve what is missing
  python3 seed/scripts/fill_elevations.py --sql      # print the UPDATE a migration needs
  python3 seed/scripts/fill_elevations.py --check    # print the sanity values

Then: python3 seed/scripts/build_seed_sql.py, which carries the column into supabase/seed.sql.
"""
import datetime, json, os, sys, time, urllib.error, urllib.parse, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from venues import ELEVATIONS, merged_venues  # noqa: E402

FEET_PER_METRE = 3.280839895
PAUSE_S = 0.5
# USGS answers only inside the United States (Puerto Rico included).
USGS_COUNTRIES = {"USA", "US", "United States", "Puerto Rico", None}


def fetch_json(url, tries=4):
    last = None
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "jinx-seed/1.0 (fill_elevations.py)"})
            with urllib.request.urlopen(req, timeout=30) as res:
                return json.loads(res.read().decode("utf8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ConnectionError) as err:
            last = err
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"{url}: {last}")


def usgs_feet(lat, lng):
    data = fetch_json(
        "https://epqs.nationalmap.gov/v1/json?" + urllib.parse.urlencode({"x": lng, "y": lat, "units": "Feet", "wkid": 4326})
    )
    value = data.get("value")
    # Outside its coverage the service answers with a sentinel (-1000000) or an empty value.
    if value in (None, ""):
        return None
    feet = float(value)
    return None if feet < -1500 else feet


def open_elevation_feet(lat, lng):
    data = fetch_json(f"https://api.open-elevation.com/api/v1/lookup?locations={lat},{lng}")
    results = data.get("results") or []
    if not results or results[0].get("elevation") is None:
        return None
    return float(results[0]["elevation"]) * FEET_PER_METRE


def load_file():
    if os.path.exists(ELEVATIONS):
        with open(ELEVATIONS, encoding="utf8") as f:
            return json.load(f)
    return {
        "_comment": "Ground elevation of each venue in whole feet, keyed by the merged venue key. Written by "
        "seed/scripts/fill_elevations.py from the USGS Elevation Point Query Service (USA) and Open-Elevation "
        "(elsewhere). Do not edit by hand; rerun the script. Source and date are in docs/verification.md.",
        "venues": {},
    }


def save_file(data):
    # Sorted on the way out, never by rebinding data["venues"]: fill() holds a reference to that
    # dict, and a rebind once left every later answer in an orphan that was never written.
    out = dict(data, venues=dict(sorted(data["venues"].items())))
    with open(ELEVATIONS, "w", encoding="utf8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
        f.write("\n")


def fill():
    data = load_file()
    done = data["venues"]
    venues = merged_venues()
    # A key that no longer exists in the seed would otherwise live in the file for ever.
    for stale in [k for k in done if k not in venues]:
        del done[stale]
    unresolved, fetched = [], 0
    for key in sorted(venues):
        v = venues[key]
        lat, lng = v["lat"], v["lng"]
        if lat is None or lng is None:
            unresolved.append((key, v["name"], "no coordinates in the seed"))
            continue
        have = done.get(key)
        if have and have.get("elevation_ft") is not None and have.get("lat") == lat and have.get("lng") == lng:
            continue
        source, feet = None, None
        try:
            if v.get("country") in USGS_COUNTRIES:
                source, feet = "usgs-epqs", usgs_feet(lat, lng)
            if feet is None:
                source, feet = "open-elevation", open_elevation_feet(lat, lng)
        except RuntimeError as err:
            unresolved.append((key, v["name"], str(err)))
            time.sleep(PAUSE_S)
            continue
        time.sleep(PAUSE_S)
        if feet is None:
            unresolved.append((key, v["name"], "no service returned a value"))
            continue
        done[key] = {
            "name": v["name"],
            "lat": lat,
            "lng": lng,
            "elevation_ft": round(feet),
            "source": source,
            "fetched": datetime.date.today().isoformat(),
        }
        fetched += 1
        save_file(data)
        print(f"{key}: {round(feet)} ft ({source})", file=sys.stderr)
    save_file(data)
    print(f"{len(done)} of {len(venues)} venues have an elevation ({fetched} fetched this run).", file=sys.stderr)
    if unresolved:
        print(f"{len(unresolved)} could not be resolved:", file=sys.stderr)
        for key, name, why in unresolved:
            print(f"  {key} ({name}): {why}", file=sys.stderr)


def sql():
    done = load_file()["venues"]
    rows = [f"  ('{k.replace(chr(39), chr(39) * 2)}', {v['elevation_ft']})" for k, v in sorted(done.items()) if v.get("elevation_ft") is not None]
    print("update public.venues v set elevation_ft = e.elevation_ft")
    print("from (values")
    print(",\n".join(rows))
    print(") as e (key, elevation_ft)")
    print("where v.key = e.key and v.elevation_ft is distinct from e.elevation_ft;")


def check():
    done = load_file()["venues"]
    for name in ("Coors Field", "Empower Field at Mile High", "Chase Field", "State Farm Stadium", "Oracle Park", "Fenway Park", "Truist Park"):
        hit = [(k, v) for k, v in done.items() if v.get("name") == name]
        for k, v in hit:
            print(f"{name}: {v['elevation_ft']} ft ({v['source']}, {k})")
        if not hit:
            print(f"{name}: not in the file")
    top = sorted(done.items(), key=lambda kv: -kv[1]["elevation_ft"])[:8]
    print("highest:", ", ".join(f"{v['name']} {v['elevation_ft']}" for _, v in top))
    low = sorted(done.items(), key=lambda kv: kv[1]["elevation_ft"])[:5]
    print("lowest:", ", ".join(f"{v['name']} {v['elevation_ft']}" for _, v in low))


if __name__ == "__main__":
    if "--sql" in sys.argv:
        sql()
    elif "--check" in sys.argv:
        check()
    else:
        fill()
