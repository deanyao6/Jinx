#!/usr/bin/env python3
"""Extract nflverse play-by-play fixtures for packages/core NFL parser and moment tests.

Usage:
    python3 ingest/nfl/scripts/extract_pbp_fixtures.py \
        --pbp /path/to/play_by_play_2024.parquet \
        --games /path/to/games.csv \
        [--out ingest/fixtures/nfl]

Writes ingest/fixtures/nfl/pbp_<game_id>.json (JSON array of row objects restricted to the
columns documented in docs/verification.md plus posteam/defteam) and
ingest/fixtures/nfl/games_2024_sample.json (the matching rows from games.csv).

Games were chosen so that the five fixtures together exercise every NFL v1 moment detector
(SPEC 6.7):
  2024_12_TEN_HOU  pick-six (HOU), safety (TEN), 50+ yard field goals, no OT / no walk-off
  2024_04_NO_ATL   pick-six (ATL), muffed punt recovered for TD (fumble_return_td, not a
                   kick return), late go-ahead FG at 0:07 followed by a kickoff (not a walk-off)
  2024_05_BAL_CIN  overtime, safety (CIN), tying 56-yd FG at 1:40, OT walk-off FG (BAL)
  2024_10_DET_HOU  14+ comeback (DET trailed 23-7), walk-off 52-yd FG at 0:04 (DET)
  2024_06_TB_NO    clean punt return TD (NO), clean fumble return TD (TB), TB TD at 2:00 while
                   already leading (late_go_ahead must not fire)
"""
from __future__ import annotations

import argparse
import json
import math
import os

import pandas as pd

GAME_IDS = [
    "2024_12_TEN_HOU",
    "2024_04_NO_ATL",
    "2024_05_BAL_CIN",
    "2024_10_DET_HOU",
    "2024_06_TB_NO",
]

# Columns named in docs/verification.md (nflverse pbp) plus posteam/defteam, which the parser
# needs to derive the possession side.
PBP_COLUMNS = [
    "game_id",
    "play_id",
    "order_sequence",
    "qtr",
    "time",
    "quarter_seconds_remaining",
    "game_seconds_remaining",
    "game_half",
    "time_of_day",
    "start_time",
    "desc",
    "sp",
    "play_type",
    "total_home_score",
    "total_away_score",
    "td_team",
    "touchdown",
    "pass_touchdown",
    "rush_touchdown",
    "return_touchdown",
    "return_team",
    "interception",
    "fumble",
    "fumble_lost",
    "safety",
    "field_goal_result",
    "kick_distance",
    "punt_attempt",
    "kickoff_attempt",
    "extra_point_attempt",
    "two_point_attempt",
    "home_team",
    "away_team",
    "home_score",
    "away_score",
    "result",
    "season_type",
    "week",
    "game_date",
    "stadium",
    "weather",
    "temp",
    "roof",
    "posteam",
    "defteam",
]

GAME_COLUMNS = [
    "game_id",
    "season",
    "game_type",
    "week",
    "gameday",
    "weekday",
    "gametime",
    "away_team",
    "away_score",
    "home_team",
    "home_score",
    "location",
    "result",
    "total",
    "overtime",
    "old_game_id",
    "gsis",
    "espn",
    "pfr",
    "roof",
    "surface",
    "temp",
    "wind",
    "stadium_id",
    "stadium",
]


def clean(value):
    """Convert pandas/numpy scalars to JSON-friendly Python values (NaN -> None)."""
    if value is None:
        return None
    if isinstance(value, float):
        if math.isnan(value):
            return None
        return int(value) if value.is_integer() else value
    if hasattr(value, "item"):  # numpy scalar
        return clean(value.item())
    if isinstance(value, str) and value == "":
        return None
    return value


def rows_to_records(frame: pd.DataFrame, columns: list[str]) -> list[dict]:
    present = [c for c in columns if c in frame.columns]
    missing = [c for c in columns if c not in frame.columns]
    if missing:
        raise SystemExit(f"missing columns: {missing}")
    return [{c: clean(row[c]) for c in present} for _, row in frame[present].iterrows()]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pbp", required=True, help="play_by_play_<season>.parquet")
    parser.add_argument("--games", required=True, help="games.csv from the schedules release")
    parser.add_argument(
        "--out",
        default=os.path.join(os.path.dirname(__file__), "..", "..", "fixtures", "nfl"),
    )
    args = parser.parse_args()

    out = os.path.abspath(args.out)
    os.makedirs(out, exist_ok=True)

    pbp = pd.read_parquet(args.pbp, columns=PBP_COLUMNS)
    games = pd.read_csv(args.games, dtype={"gametime": "string", "old_game_id": "string"})

    for game_id in GAME_IDS:
        plays = pbp[pbp.game_id == game_id].sort_values(["order_sequence", "play_id"])
        if plays.empty:
            raise SystemExit(f"no plays for {game_id}")
        path = os.path.join(out, f"pbp_{game_id}.json")
        with open(path, "w") as fh:
            json.dump(rows_to_records(plays, PBP_COLUMNS), fh, separators=(",", ":"))
        print(f"{path}: {len(plays)} rows, {os.path.getsize(path) // 1024} KB")

    sample = games[games.game_id.isin(GAME_IDS)]
    if len(sample) != len(GAME_IDS):
        raise SystemExit(f"expected {len(GAME_IDS)} game rows, got {len(sample)}")
    path = os.path.join(out, "games_2024_sample.json")
    with open(path, "w") as fh:
        json.dump(rows_to_records(sample, GAME_COLUMNS), fh, indent=2)
    print(f"{path}: {len(sample)} rows")


if __name__ == "__main__":
    main()
