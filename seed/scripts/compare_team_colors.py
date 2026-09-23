#!/usr/bin/env python3
"""Cross-check seed/team_colors.json and seed/mls_colors.json against jimniels/teamcolors
(next-wave F). Our fill (--tf, the badge fill, the same in both themes) and our light secondary
(--t2) are each compared to the nearest of the source's colours by CIE76 distance in Lab. The
source lists colours in no reliable order (it puts the Yankees' red first), so "which colour
leads" stays ours and the reference's; what the check finds is a colour the source does not
know at all.

  python3 seed/scripts/compare_team_colors.py <teamcolors.json> [--espn=<dir>] [--propose=out.json] [--apply]

--espn names a folder holding ESPN's four teams responses (espn_teams_<league>.json, from
site.api.espn.com/apis/site/v2/sports/<sport>/<league>/teams?limit=100), whose `color` and
`alternateColor` are current for every active team. jimniels/teamcolors is dated (its NBA
document is the 2014-15 composite, its MLS rows are approximations and stop at 22 clubs), so
where the two disagree the proposal follows ESPN and the table says the older source is stale.

Prints a markdown table, biggest differences first. --propose writes the rows it would change:
hand-tuned rows only (the reference's 13 verbatim rows are reported, never changed): a fill the
source does not know becomes the source colour nearest to ours that clears 4.5:1 on white (else
kept, and said so), a secondary the source does not know becomes the source colour nearest to
ours that is not the fill, and dark variants are lightened along the same hue to the lightness
our current dark variant has, so they still clear 4.5:1 on #0E1115. Nearest, not first: the
source lists the Yankees' red before their navy, and the lead colour is ours to choose.
--apply writes those rows back into the seed files.
"""
import json
import os
import re
import sys
import colorsys

HERE = os.path.dirname(os.path.abspath(__file__))
SEED = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from check_team_colors import contrast, load  # noqa: E402

SCREEN_LIGHT = "#FFFFFF"
SCREEN_DARK = "#0E1115"
MIN_RATIO = 4.5
MATERIAL = 15.0  # CIE76 ΔE above which a difference is worth a look (the source's near-black #061922 against #000000 is 12)
# Rows kept on purpose although both sources disagree, with the reason the table prints.
KEEP = {
    ("mlb", "146"): "Caliente red is the Marlins' 2019 identity; ESPN lists black, the older source the 2012 orange",
}
FILL_MATERIAL = 20.0  # the fill is the team's identity; a shade apart is not a different colour

# Our team names as the source spells them, where a plain normalisation is not enough.
ALIASES = {
    "athletics": "oakland athletics",
    "los angeles angels": "los angeles angels of anaheim",
    "las vegas raiders": "oakland raiders",
    "red bull new york": "new york red bulls",
    "montreal": "montreal impact",
    "la clippers": "los angeles clippers",
    "d c united": "dc united",
    "cf montreal": "montreal impact",
    "chicago fire fc": "chicago fire",
    "houston dynamo fc": "houston dynamo",
    "columbus crew sc": "columbus crew",
    "sporting kansas city": "sporting kansas city",
    "los angeles rams": "los angeles rams",
    "washington commanders": "washington commanders",
}


def norm(name):
    n = name.lower().replace("é", "e")
    n = re.sub(r"[.'’]", "", n)
    n = re.sub(r"[^a-z0-9]+", " ", n).strip()
    n = re.sub(r"\b(fc|sc|cf)\b", "", n).strip()
    n = re.sub(r"\s+", " ", n)
    return ALIASES.get(n, n)


def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def rgb_to_hex(rgb):
    return "#%02X%02X%02X" % tuple(max(0, min(255, round(c))) for c in rgb)


def rgb_to_lab(rgb):
    def lin(c):
        c /= 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = (lin(c) for c in rgb)
    x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047
    y = r * 0.2126 + g * 0.7152 + b * 0.0722
    z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883

    def f(t):
        return t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116

    fx, fy, fz = f(x), f(y), f(z)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


def delta_e(a, b):
    la, lb = rgb_to_lab(hex_to_rgb(a)), rgb_to_lab(hex_to_rgb(b))
    return sum((p - q) ** 2 for p, q in zip(la, lb)) ** 0.5


def lighten_to(hex_color, target_hex):
    """The colour with hex_color's hue and saturation at target_hex's HLS lightness, then
    nudged lighter until it clears the dark-screen contrast."""
    r, g, b = (c / 255 for c in hex_to_rgb(hex_color))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    tr, tg, tb = (c / 255 for c in hex_to_rgb(target_hex))
    _, tl, _ = colorsys.rgb_to_hls(tr, tg, tb)
    l = max(l, tl)
    for _ in range(40):
        out = rgb_to_hex(tuple(c * 255 for c in colorsys.hls_to_rgb(h, l, s)))
        if contrast(out, SCREEN_DARK) >= MIN_RATIO:
            return out
        l = min(1.0, l + 0.02)
    return out


def our_rows():
    main = load("team_colors.json")
    mls = load("mls_colors.json")
    names = {}
    for t in load("mlb_teams.generated.json"):
        names[("mlb", t["provider_team_id"])] = t["name"]
    for t in load("nfl_teams.json"):
        if t["active"]:
            names[("nflverse", t["abbr"])] = f"{t['city']} {t['name']}"
    for t in load("nba_teams.json")["teams"]:
        if t["active"]:
            names[("nba", t["provider_team_id"])] = f"{t['city']} {t['name']}"
    for t in load("mls_teams.json")["teams"]:
        names[("espn_mls", t["provider_team_id"])] = t["name"]
    rows = []
    for r in main["teams"] + mls["teams"]:
        rows.append((names.get((r["provider"], r["provider_team_id"]), r["team"]), r))
    return main, mls, rows


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        sys.exit(__doc__)
    with open(args[0], encoding="utf8") as f:
        source = {norm(t["name"]): t for t in json.load(f) if t.get("league") in ("mlb", "nfl", "nba", "mls")}
    espn = {}
    for a in sys.argv[1:]:
        if a.startswith("--espn="):
            folder = a.split("=", 1)[1]
            for fn in os.listdir(folder):
                if not fn.startswith("espn_teams_"):
                    continue
                with open(os.path.join(folder, fn), encoding="utf8") as f:
                    for t in json.load(f)["sports"][0]["leagues"][0]["teams"]:
                        t = t["team"]
                        espn[norm(t["displayName"])] = ("#" + t["color"].upper(), "#" + t["alternateColor"].upper())
    main_file, mls_file, rows = our_rows()
    table = []
    unmatched = []
    proposals = []
    for name, r in rows:
        src = source.get(norm(name))
        current = espn.get(norm(name))
        if src is None and current is None:
            unmatched.append(f"{r['provider']} {r['abbr']} {name}")
            continue
        if src is None:
            src = {"colors": {"hex": []}}
        colors = src["colors"]
        if "hex" in colors:
            hexes = ["#" + h.upper() for h in colors["hex"]]
        else:  # a few source rows carry RGB only, as "r g b"
            hexes = [rgb_to_hex(tuple(int(x) for x in re.split(r"[,\s]+", v.strip()))) for v in colors["rgb"]]
        # The secondary is compared against colours other than the fill's own, otherwise a row
        # whose --t2 merely repeats --t (every MLS row before this check) looks fine.
        others = [h for h in hexes if delta_e(h, r["fill_hex"]) >= MATERIAL]
        d_fill = min((delta_e(r["fill_hex"], h) for h in hexes), default=None)
        d_second = min((delta_e(r["secondary_light_hex"], h) for h in others), default=None) if hexes else None
        primary = " ".join(hexes) or "-"
        e_fill = e_second = None
        e_other = None
        if current:
            e_fill = min(delta_e(r["fill_hex"], h) for h in current)
            e_other = max(current, key=lambda h: delta_e(r["fill_hex"], h))
            e_second = delta_e(r["secondary_light_hex"], e_other)
        note = ""
        change = None
        # A change needs both sources to disagree with ours (a missing source does not vote):
        # the older one is stale for a rebrand, ESPN's `color` is not always the club's lead.
        fill_off = all(d is not None and d >= FILL_MATERIAL for d in (d_fill, e_fill) if d is not None) and any(d is not None for d in (d_fill, e_fill))
        second_off = all(d is not None and d >= MATERIAL for d in (d_second, e_second) if d is not None) and any(d is not None for d in (d_second, e_second))
        if r["source"] == "reference":
            note = "reference row, kept"
        elif (r["provider"], r["provider_team_id"]) in KEEP:
            note = "kept: " + KEEP[(r["provider"], r["provider_team_id"])]
        elif current is None and d_fill is None:
            note = ""
        elif not (fill_off or second_off):
            if (e_fill is not None and e_fill >= FILL_MATERIAL) or (e_second is not None and e_second >= MATERIAL):
                note = "ESPN differs, the older source agrees with ours, kept"
            elif (d_fill is not None and d_fill >= FILL_MATERIAL) or (d_second is not None and d_second >= MATERIAL):
                note = "older source stale, ESPN agrees with ours, kept"
        else:
            new = dict(r)
            if fill_off:
                pool = ([current[0], current[1]] if current else []) + sorted(hexes, key=lambda h: delta_e(r["fill_hex"], h))
                fill = next((h for h in pool if contrast(h, SCREEN_LIGHT) >= MIN_RATIO), None)
                if fill:
                    new["fill_hex"] = fill
                    new["primary_light_hex"] = fill
                    new["primary_dark_hex"] = lighten_to(fill, r["primary_dark_hex"])
                else:
                    note = "fill kept: no source colour clears 4.5:1 on white"
            if second_off:
                pool = ([e_other, current[0]] if current else []) + sorted(hexes, key=lambda h: delta_e(r["secondary_light_hex"], h))
                sec = next((h for h in pool if h and delta_e(h, new["fill_hex"]) >= MATERIAL and contrast(h, SCREEN_LIGHT) >= 1.5), None)
                if sec:
                    new["secondary_light_hex"] = sec
                    new["secondary_dark_hex"] = sec if contrast(sec, SCREEN_DARK) >= MIN_RATIO else lighten_to(sec, r["secondary_dark_hex"])
                else:
                    note = (note + "; " if note else "") + "--t2 kept: the other colour is white"
            if new != r:
                change = new
                proposals.append(new)
        current_txt = " ".join(current) if current else "-"
        table.append((max(e_fill or 0, e_second or 0, (d_fill or 0) / 4), name, r, primary, current_txt, d_fill, d_second, e_fill, e_second, note, change))
    table.sort(key=lambda t: -t[0])
    fmt = lambda v: "-" if v is None else f"{v:.0f}"  # noqa: E731
    print("| Team | Ours: fill / light --t2 | jimniels/teamcolors | ΔE to nearest (fill, --t2) | ESPN colour / alt | ΔE to ESPN (fill, --t2) | Proposed |")
    print("|---|---|---|---|---|---|---|")
    for _, name, r, primary, current_txt, d_fill, d_second, e_fill, e_second, note, change in table:
        proposed = note or ("same" if change is None else (
            (f"fill and --t {change['fill_hex']}, dark --t {change['primary_dark_hex']}; " if change["fill_hex"] != r["fill_hex"] else "")
            + (f"--t2 {change['secondary_light_hex']} (dark {change['secondary_dark_hex']})" if change["secondary_light_hex"] != r["secondary_light_hex"] else "")
        ).rstrip("; "))
        print(
            f"| {name} ({r['provider'].replace('nflverse', 'nfl').replace('espn_mls', 'mls')}) | {r['fill_hex']} / {r['secondary_light_hex']} | {primary} | {fmt(d_fill)}, {fmt(d_second)} | {current_txt} | {fmt(e_fill)}, {fmt(e_second)} | {proposed} |"
        )
    print()
    print(f"{len(table)} compared, {len(unmatched)} in neither source, {len(proposals)} proposed changes; "
          f"{sum(1 for t in table if t[5] is None)} not in jimniels/teamcolors, {sum(1 for t in table if t[7] is None)} not on ESPN")
    for p in proposals:
        assert contrast(p["primary_light_hex"], SCREEN_LIGHT) >= MIN_RATIO and contrast(p["primary_dark_hex"], SCREEN_DARK) >= MIN_RATIO, p["abbr"]
    print("every proposal clears 4.5:1 on both screens")
    for u in unmatched:
        print(f"  not in the source: {u}")
    out = [a for a in sys.argv[1:] if a.startswith("--propose=")]
    if out:
        with open(out[0].split("=", 1)[1], "w", encoding="utf8") as f:
            json.dump(proposals, f, indent=2, ensure_ascii=False)
    if "--apply" in sys.argv:
        by_key = {(p["provider"], p["provider_team_id"]): p for p in proposals}
        for file_name, data in (("team_colors.json", main_file), ("mls_colors.json", mls_file)):
            data["teams"] = [by_key.get((r["provider"], r["provider_team_id"]), r) for r in data["teams"]]
            with open(os.path.join(SEED, file_name), "w", encoding="utf8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
                f.write("\n")
        print(f"applied {len(proposals)} rows")


if __name__ == "__main__":
    main()
