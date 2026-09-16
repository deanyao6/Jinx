#!/usr/bin/env python3
"""Generate the static Archivo instances the app bundles (SPEC.md 8.2).

`design/reference.html` loads Archivo as a *variable* font and styles text with
`font-variation-settings:"wdth" N` alongside `font-weight`. React Native has no reliable
support for variable font axes, so every (wdth, wght) pair the reference actually uses is
pinned here into its own static TTF with fontTools' `varLib.instancer`, and the results are
registered with expo-font.

The output is deterministic: two runs produce byte-identical files, so re-running this and
seeing a clean `git status` means the assets match the reference.

Usage:
    python3 scripts/fonts/build-archivo.py            # download if needed, then generate
    python3 scripts/fonts/build-archivo.py --refresh  # re-download the source font first
    python3 scripts/fonts/build-archivo.py --check     # fail if any output is missing/stale

Requires fontTools (`python3 -m pip install --user fonttools`, or any venv on PATH).
"""

from __future__ import annotations

import argparse
import hashlib
import io
import shutil
import sys
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
CACHE_DIR = Path(__file__).resolve().parent / ".cache"
OUT_DIR = REPO_ROOT / "apps" / "mobile" / "assets" / "fonts"

# The upstream variable font and its licence, from the canonical Google Fonts repo.
# Archivo's axes are wght 100..900 (default 600) and wdth 62..125 (default 100).
FONT_URL = "https://github.com/google/fonts/raw/main/ofl/archivo/Archivo%5Bwdth%2Cwght%5D.ttf"
LICENSE_URL = "https://github.com/google/fonts/raw/main/ofl/archivo/OFL.txt"
SRC_FONT = CACHE_DIR / "Archivo[wdth,wght].ttf"
SRC_LICENSE = CACHE_DIR / "OFL.txt"

# Every (wdth, wght) pair used by design/reference.html, with the rules that ask for it.
# Derived by reading every CSS rule, every `style=` attribute and every SVG `font-weight`
# attribute in the reference. Re-derive this list if the reference changes.
INSTANCES: list[tuple[int, int, str]] = [
    # --- Condensed display faces (explicit `font-variation-settings`) ---
    (62, 900, ".hero .rec, .ring .c b, .vs strong, .loghead b, .scorebug .sc, .fx-word, "
              ".fx-rec b, .fx-rc b, .fx-sh h3"),
    (64, 900, ".side .pct, .fr .rec, .fx-wr strong, .intro h1 (page chrome)"),
    (66, 900, ".ticket b"),
    (70, 700, ".ticket .seat strong (no font-weight in the rule; `strong` inherits the UA bold)"),
    (70, 850, ".tile b"),
    (72, 850, ".li .val, .side b"),
    (74, 850, ".stats b"),
    (78, 850, ".tl time"),
    (80, 850, ".circ"),
    (80, 900, ".fx-bd"),
    # --- Default width (wdth 100): every `font-weight` used without a width override ---
    (100, 400, "body default"),
    (100, 500, ".wplbl .dog"),
    (100, 600, ".scorebug .sc small"),
    (100, 650, ".status, .fx-last, .fx-stamp span, .fx-chip, .fx-at, .fx-story"),
    (100, 700, ".pill[aria-pressed], .sec a, .stamp b, .li .tx b, .live, .tchip, .fx-pill, "
               "bare <b>/<strong>, SVG text font-weight=\"700\""),
    (100, 750, ".tabs .on, .seg [aria-selected], .side .tag, .lockpill, .wplbl, .scorebug .tm, "
               ".fx-sub, .fx-r1, .fx-rc .lb, .fx-sh a, .fx-seg [aria-selected], .fx-wpl, "
               ".fx-story small"),
    (100, 800, ".sec h3, .badge, .matchup .v, .choose button, .fx-stamp b, .fx-row .tx b, "
               ".fx-mu b, .fx-root, SVG text font-weight=\"800\""),
    (100, 850, ".top h2, .vhero b, .prof h4, .matchup b, .fx-pill .n, .fx-li .tx b, .fx-title, "
               ".fx-live, .fx-lock, .fx-h1, .fx-vs, .fx-sth"),
    (100, 900, ".fx-res, SVG text font-weight=\"900\""),
]


def instance_name(wdth: int, wght: int) -> str:
    """File stem and internal font family name. Kept identical so the asset is self-describing."""
    return f"Archivo_wdth{wdth}_wght{wght}"


def download(url: str, dest: Path, refresh: bool) -> None:
    if dest.exists() and dest.stat().st_size > 0 and not refresh:
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"  downloading {dest.name} ...")
    with urllib.request.urlopen(url, timeout=120) as response:  # noqa: S310 - fixed https URL
        data = response.read()
    if len(data) < 1024:
        raise SystemExit(f"{url} returned only {len(data)} bytes; refusing to use it")
    dest.write_bytes(data)


def rename(font, family: str) -> None:
    """Point every name record at `family`.

    `instancer(updateFontNames=True)` derives names from the STAT table, which only knows the
    named instances (Regular, Bold, Condensed, ...). Most of the pairs below are unnamed
    coordinates like wdth 72 / wght 850, so that path raises. Naming them here instead keeps
    the family name equal to the file stem and to the key used in apps/mobile/src/theme/fonts.ts.
    """
    name_table = font["name"]
    name_table.names = []
    for name_id, value in (
        (1, family),  # family
        (2, "Regular"),  # subfamily: each instance is a standalone "Regular"
        (3, f"{family};Jinx"),  # unique id
        (4, family),  # full name
        (6, family),  # PostScript name
    ):
        name_table.setName(value, name_id, 3, 1, 0x409)  # Windows / Unicode BMP / en-US
        name_table.setName(value, name_id, 1, 0, 0)  # Macintosh / Roman / English
    # A static instance must not advertise a weight/width class that contradicts its outlines.
    os2 = font["OS/2"]
    os2.usWeightClass = max(1, min(1000, WGHT_OF[family]))
    os2.usWidthClass = WIDTH_CLASS[WDTH_OF[family]]


# usWidthClass is a 1..9 enum, not a percentage. Map each pinned wdth to the nearest bucket.
_WIDTH_BUCKETS = [(50, 1), (62.5, 2), (75, 3), (87.5, 4), (100, 5), (112.5, 6), (125, 7), (150, 8), (200, 9)]
WIDTH_CLASS = {
    wdth: min(_WIDTH_BUCKETS, key=lambda b: abs(b[0] - wdth))[1]
    for wdth, _, _ in INSTANCES
}
WGHT_OF = {instance_name(w, g): g for w, g, _ in INSTANCES}
WDTH_OF = {instance_name(w, g): w for w, g, _ in INSTANCES}


def build(check_only: bool, refresh: bool) -> int:
    try:
        from fontTools.ttLib import TTFont
        from fontTools.varLib import instancer
    except ImportError:
        print(
            "fontTools is not installed.\n"
            "  python3 -m pip install --user fonttools\n"
            "or, in a gitignored venv:\n"
            "  python3 -m venv .venv && .venv/bin/pip install fonttools && "
            ".venv/bin/python scripts/fonts/build-archivo.py",
            file=sys.stderr,
        )
        return 1

    print(f"Archivo static instances -> {OUT_DIR.relative_to(REPO_ROOT)}")
    download(FONT_URL, SRC_FONT, refresh)
    download(LICENSE_URL, SRC_LICENSE, refresh)

    # recalcTimestamp=False keeps head.modified at the upstream value, so the output is
    # byte-identical between runs and a re-run leaves git clean.
    source = TTFont(SRC_FONT, recalcTimestamp=False)
    axes = {a.axisTag: (a.minValue, a.maxValue) for a in source["fvar"].axes}
    for wdth, wght, _ in INSTANCES:
        for tag, value in (("wdth", wdth), ("wght", wght)):
            low, high = axes[tag]
            if not low <= value <= high:
                raise SystemExit(f"{tag} {value} is outside the font's {low}..{high} range")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    stale: list[str] = []
    total = 0
    rows: list[tuple[str, int, str]] = []

    for wdth, wght, used_by in INSTANCES:
        family = instance_name(wdth, wght)
        dest = OUT_DIR / f"{family}.ttf"
        font = instancer.instantiateVariableFont(
            TTFont(SRC_FONT, recalcTimestamp=False),
            {"wdth": wdth, "wght": wght},
            inplace=False,
            updateFontNames=False,
        )
        rename(font, family)
        buffer = io.BytesIO()
        font.save(buffer)
        data = buffer.getvalue()
        total += len(data)

        existing = dest.read_bytes() if dest.exists() else b""
        changed = hashlib.sha256(existing).digest() != hashlib.sha256(data).digest()
        if changed:
            stale.append(dest.name)
            if not check_only:
                dest.write_bytes(data)
        rows.append((family, len(data), "written" if changed else "up to date"))
        print(f"  {family:<28} {len(data):>8,} B  {rows[-1][2]:<11} {used_by.split(',')[0]}")

    license_dest = OUT_DIR / "OFL.txt"
    license_changed = (
        not license_dest.exists() or license_dest.read_bytes() != SRC_LICENSE.read_bytes()
    )
    if license_changed:
        stale.append(license_dest.name)
        if not check_only:
            shutil.copyfile(SRC_LICENSE, license_dest)
    total += license_dest.stat().st_size if license_dest.exists() else 0

    print(f"\n  {len(INSTANCES)} instances, {total:,} bytes ({total / 1024 / 1024:.2f} MiB) total")

    if check_only and stale:
        print(f"\nstale or missing: {', '.join(stale)}", file=sys.stderr)
        print("run: python3 scripts/fonts/build-archivo.py", file=sys.stderr)
        return 1
    if not stale:
        print("  nothing to do; assets already match the reference")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true", help="re-download the source font")
    parser.add_argument(
        "--check", action="store_true", help="report stale output without writing anything"
    )
    args = parser.parse_args()
    return build(check_only=args.check, refresh=args.refresh)


if __name__ == "__main__":
    raise SystemExit(main())
