#!/usr/bin/env python3
"""Génère songs.csv, users.csv et events.csv pour SoundHub (SEED = 2026).

Usage :
    python generate_data.py --dataset dataset.csv --out imports --users 1000 --events 100000
"""
import argparse
import uuid
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
from faker import Faker

SEED = 2026
REF_DATE = pd.Timestamp("2026-11-01 00:00:00")  # date de référence fixe (déterminisme)
DAYS_BACK = 90


def build_songs(src: Path, out_dir: Path) -> pd.DataFrame:
    df = pd.read_csv(src)
    df = df.loc[:, ~df.columns.str.startswith("Unnamed")]
    # Une même chanson apparaît une fois par genre : on garde une seule ligne par track_id
    df = df.dropna(subset=["track_id", "track_name"]).drop_duplicates(subset="track_id", keep="first")
    df = df.rename(columns={"track_id": "song_id"}).reset_index(drop=True)
    df.to_csv(out_dir / "songs.csv", index=False)
    return df


def build_users(n: int, out_dir: Path) -> pd.DataFrame:
    fake = Faker()
    fake.seed_instance(SEED)
    rows = []
    for i in range(1, n + 1):
        rows.append(
            {
                "user_id": f"U{i:05d}",
                "username": fake.unique.user_name(),
                "email": fake.unique.email(),
                "country": fake.country_code(),
                "created_at": fake.date_time_between(
                    start_date=datetime(2023, 11, 1), end_date=datetime(2026, 11, 1)
                ).strftime("%Y-%m-%d %H:%M:%S"),
            }
        )
    df = pd.DataFrame(rows)
    df.to_csv(out_dir / "users.csv", index=False)
    return df


def build_events(songs: pd.DataFrame, users: pd.DataFrame, n: int, out_dir: Path) -> pd.DataFrame:
    rng = np.random.default_rng(SEED)

    user_idx = rng.integers(0, len(users), n)
    # Les chansons populaires sont écoutées plus souvent
    w = songs["popularity"].fillna(0).to_numpy(dtype=float) + 1.0
    song_idx = rng.choice(len(songs), size=n, p=w / w.sum())

    types = rng.choice(["play", "skip", "add"], size=n, p=[0.70, 0.22, 0.08])
    seconds = rng.integers(0, DAYS_BACK * 24 * 3600, n)
    ts = REF_DATE - pd.to_timedelta(seconds, unit="s")

    dur = songs["duration_ms"].to_numpy()[song_idx].astype(np.int64)
    frac = rng.uniform(0.3, 1.0, n)
    skip_ms = np.minimum(dur, rng.integers(1000, 30000, n))
    listened = np.where(types == "play", (dur * frac).astype(np.int64), np.where(types == "skip", skip_ms, 0))

    devices = rng.choice(["mobile", "desktop", "web", "tv"], size=n, p=[0.55, 0.25, 0.15, 0.05])

    hi = rng.integers(0, 2**62, n)
    lo = rng.integers(0, 2**62, n)
    event_ids = [str(uuid.UUID(int=(int(a) << 64) | int(b), version=4)) for a, b in zip(hi, lo)]

    df = pd.DataFrame(
        {
            "event_id": event_ids,
            "user_id": users["user_id"].to_numpy()[user_idx],
            "song_id": songs["song_id"].to_numpy()[song_idx],
            "event_type": types,
            "event_ts": ts.strftime("%Y-%m-%d %H:%M:%S"),
            "duration_listened_ms": listened,
            "device": devices,
        }
    ).sort_values("event_ts").reset_index(drop=True)
    df.to_csv(out_dir / "events.csv", index=False)
    return df


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--dataset", default="dataset.csv", help="CSV Spotify (Kaggle)")
    p.add_argument("--out", default="imports", help="dossier de sortie")
    p.add_argument("--users", type=int, default=1000)
    p.add_argument("--events", type=int, default=100000)
    args = p.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    songs = build_songs(Path(args.dataset), out_dir)
    users = build_users(args.users, out_dir)
    events = build_events(songs, users, args.events, out_dir)
    print(f"songs.csv  : {len(songs)} chansons")
    print(f"users.csv  : {len(users)} utilisateurs")
    print(f"events.csv : {len(events)} événements")


if __name__ == "__main__":
    main()
