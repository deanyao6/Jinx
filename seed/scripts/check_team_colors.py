#!/usr/bin/env python3
"""Audit seed/team_colors.json.

Checks, in order:
  1. every hex matches the team_colors CHECK constraint (^#[0-9a-f]{6}$, case-insensitive);
  2. every MLB and NFL team in the seed files has exactly one palette, and no palette is orphaned;
  3. every row marked source 'reference' still matches design/reference.html verbatim;
  4. WCAG 2.1 contrast of --t against its screen background:
       primary_light_hex on --scr light (#FFFFFF)
       primary_dark_hex  on --scr dark  (#0E1115)
     Anything under 4.5:1 is reported. Hand-tuned rows must clear it; the reference rows are
     authoritative (SPEC.md 8.2) and are reported but never "fixed".

Run: python3 seed/scripts/check_team_colors.py
Exits non-zero if a hand-tuned palette fails any check.
"""

import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SEED = os.path.join(ROOT, "seed")
REFERENCE = os.path.join(ROOT, "design", "reference.html")

SCREEN_LIGHT = "#FFFFFF"  # --scr, light
SCREEN_DARK = "#0E1115"  # --scr, dark
MIN_RATIO = 4.5  # WCAG 2.1 AA, normal text

HEX = re.compile(r"^#[0-9a-fA-F]{6}$")
HEX_FIELDS = (
    "fill_hex",
    "on_fill_hex",
    "primary_light_hex",
    "secondary_light_hex",
    "primary_dark_hex",
    "secondary_dark_hex",
)

# .t-* class in design/reference.html -> (provider, provider_team_id).
# .t-none is the neutral theme and has no team row, so it is not seeded.
REFERENCE_CLASSES = {
    "phi": ("mlb", "143"),  # Phillies
    "nym": ("mlb", "121"),  # Mets
    "lad": ("mlb", "119"),  # Dodgers
    "sf": ("mlb", "137"),  # Giants (MLB)
    "chc": ("mlb", "112"),  # Cubs
    "bos": ("mlb", "111"),  # Red Sox
    "sd": ("mlb", "135"),  # Padres
    "nyg": ("nflverse", "NYG"),  # Giants (NFL)
    "phl": ("nflverse", "PHI"),  # Eagles
    "chi": ("nflverse", "CHI"),  # Bears
    "gb": ("nflverse", "GB"),  # Packers
    "lar": ("nflverse", "LA"),  # Rams
    "lv": ("nflverse", "LV"),  # Raiders
}


def load(name):
    with open(os.path.join(SEED, name), encoding="utf8") as f:
        return json.load(f)


def channel(v):
    v /= 255
    return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4


def luminance(hex_color):
    h = hex_color.lstrip("#")
    r, g, b = (channel(int(h[i : i + 2], 16)) for i in (0, 2, 4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b):
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def parse_reference():
    """Pull the light .t-* declarations and their dark overrides out of the reference CSS."""
    with open(REFERENCE, encoding="utf8") as f:
        css = f.read()
    light, dark = {}, {}
    for name, body in re.findall(r"^\.t-([a-z]+)\{([^}]*)\}", css, re.M):
        light[name] = dict(re.findall(r"--(\w+):(#[0-9A-Fa-f]{3,6})", body))
    for name, body in re.findall(
        r'^:root\[data-theme="dark"\] \.t-([a-z]+)\{([^}]*)\}', css, re.M
    ):
        dark[name] = dict(re.findall(r"--(\w+):(#[0-9A-Fa-f]{3,6})", body))
    return light, dark


def expand(hex_color):
    """#fff -> #FFFFFF, so reference shorthand can be compared to the stored six-digit form."""
    h = hex_color.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return "#" + h.upper()


def main():
    data = load("team_colors.json")
    rows = data["teams"]
    problems = []
    warnings = []

    # 1. hex shape, uniqueness
    seen = set()
    for row in rows:
        key = (row["provider"], row["provider_team_id"])
        if key in seen:
            problems.append(f"{row['abbr']}: duplicate palette for {key}")
        seen.add(key)
        for field in HEX_FIELDS:
            value = row.get(field)
            if not value or not HEX.match(value):
                problems.append(f"{row['abbr']}: {field} = {value!r} violates ^#[0-9a-f]{{6}}$")
        if row["source"] not in ("reference", "hand_tuned"):
            problems.append(f"{row['abbr']}: source = {row['source']!r}")

    # 2. coverage against the team seeds
    expected = {("mlb", t["provider_team_id"]): t["name"] for t in load("mlb_teams.generated.json")}
    expected.update(
        {("nflverse", t["abbr"]): f"{t['city']} {t['name']}" for t in load("nfl_teams.json")}
    )
    for key, name in sorted(expected.items()):
        if key not in seen:
            problems.append(f"no palette for {name} ({key[0]}/{key[1]})")
    for key in sorted(seen - set(expected)):
        problems.append(f"palette for unknown team {key[0]}/{key[1]}")

    # 3. the reference rows are verbatim
    light, dark = parse_reference()
    by_key = {(r["provider"], r["provider_team_id"]): r for r in rows}
    for css_name, key in sorted(REFERENCE_CLASSES.items()):
        row = by_key.get(key)
        if row is None:
            problems.append(f".t-{css_name}: no palette row for {key[0]}/{key[1]}")
            continue
        if row["source"] != "reference":
            problems.append(f".t-{css_name}: {row['abbr']} should be source 'reference'")
        want = {
            "fill_hex": light[css_name]["tf"],
            "on_fill_hex": light[css_name]["on"],
            "primary_light_hex": light[css_name]["t"],
            "secondary_light_hex": light[css_name]["t2"],
            "primary_dark_hex": dark[css_name]["t"],
            "secondary_dark_hex": dark[css_name]["t2"],
        }
        for field, value in want.items():
            if expand(row[field]) != expand(value):
                problems.append(
                    f".t-{css_name} ({row['abbr']}): {field} is {row[field]}, "
                    f"reference says {value}"
                )

    # 4. contrast
    results = []
    for row in rows:
        light_ratio = contrast(row["primary_light_hex"], SCREEN_LIGHT)
        dark_ratio = contrast(row["primary_dark_hex"], SCREEN_DARK)
        results.append((row, light_ratio, dark_ratio))
        for theme, ratio, value, bg in (
            ("light", light_ratio, row["primary_light_hex"], SCREEN_LIGHT),
            ("dark", dark_ratio, row["primary_dark_hex"], SCREEN_DARK),
        ):
            if ratio < MIN_RATIO:
                message = (
                    f"{row['abbr']:4} {row['team']:24} {theme:5} --t {value} on {bg} "
                    f"= {ratio:.2f}:1 (want >= {MIN_RATIO})"
                )
                (warnings if row["source"] == "reference" else problems).append(message)

    for row, light_ratio, dark_ratio in sorted(results, key=lambda r: min(r[1], r[2])):
        print(
            f"{row['provider'][:3]:3} {row['abbr']:4} {row['team']:24} "
            f"light {row['primary_light_hex']} {light_ratio:6.2f}:1   "
            f"dark {row['primary_dark_hex']} {dark_ratio:6.2f}:1   {row['source']}"
        )

    worst_light = min(results, key=lambda r: r[1])
    worst_dark = min(results, key=lambda r: r[2])
    tuned = [r for r in results if r[0]["source"] == "hand_tuned"]
    print()
    print(f"{len(rows)} palettes ({len(rows) - len(tuned)} reference, {len(tuned)} hand-tuned)")
    print(f"worst light --t: {worst_light[0]['abbr']} {worst_light[1]:.2f}:1")
    print(f"worst dark  --t: {worst_dark[0]['abbr']} {worst_dark[2]:.2f}:1")
    if tuned:
        print(
            f"worst hand-tuned: light {min(r[1] for r in tuned):.2f}:1, "
            f"dark {min(r[2] for r in tuned):.2f}:1"
        )

    for message in warnings:
        print(f"note (reference, authoritative, left as-is): {message}", file=sys.stderr)
    for message in problems:
        print(f"FAIL: {message}", file=sys.stderr)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
