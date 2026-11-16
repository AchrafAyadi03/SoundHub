#!/usr/bin/env python3
"""Crée le schéma Cassandra et charge imports/events.csv dans les tables.

Usage :
    python load_cassandra.py --events imports/events.csv
"""
import argparse
import uuid
from pathlib import Path

import pandas as pd
from cassandra.cluster import Cluster
from cassandra.concurrent import execute_concurrent_with_args

KEYSPACE = "soundhub"
TABLES = ["events_by_user", "events_by_user_type", "events_by_song_day", "activity_log", "song_stats"]


def run_schema(session, path: Path):
    lines = [l for l in path.read_text(encoding="utf-8").splitlines() if not l.strip().startswith("--")]
    for stmt in "\n".join(lines).split(";"):
        if stmt.strip():
            session.execute(stmt)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--events", default="imports/events.csv")
    p.add_argument("--schema", default="schema.cql")
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=9042)
    args = p.parse_args()

    cluster = Cluster([args.host], port=args.port)
    session = cluster.connect()
    session.default_timeout = 120
    run_schema(session, Path(args.schema))
    session.set_keyspace(KEYSPACE)

    # Rechargement idempotent (les compteurs ne le sont pas, donc on vide tout)
    for t in TABLES:
        session.execute(f"TRUNCATE {t}")

    df = pd.read_csv(args.events)
    df["ts"] = pd.to_datetime(df["event_ts"]).dt.to_pydatetime()
    df["day"] = pd.to_datetime(df["event_ts"]).dt.strftime("%Y-%m-%d")
    df["uid"] = df["event_id"].map(uuid.UUID)

    cols = ["user_id", "song_id", "event_type", "ts", "day", "uid", "duration_listened_ms", "device"]
    rows = list(df[cols].itertuples(index=False, name=None))
    # r = (user_id, song_id, event_type, ts, day, uid, listened, device)

    inserts = {
        "events_by_user": (
            "INSERT INTO events_by_user (user_id, event_ts, event_id, song_id, event_type, duration_listened_ms, device) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            lambda r: (r[0], r[3], r[5], r[1], r[2], int(r[6]), r[7]),
        ),
        "events_by_user_type": (
            "INSERT INTO events_by_user_type (user_id, event_type, event_ts, event_id, song_id, duration_listened_ms, device) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            lambda r: (r[0], r[2], r[3], r[5], r[1], int(r[6]), r[7]),
        ),
        "events_by_song_day": (
            "INSERT INTO events_by_song_day (song_id, day, event_ts, event_id, user_id, event_type, duration_listened_ms, device) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            lambda r: (r[1], r[4], r[3], r[5], r[0], r[2], int(r[6]), r[7]),
        ),
        "activity_log": (
            "INSERT INTO activity_log (day, event_ts, event_id, user_id, song_id, event_type, device) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            lambda r: (r[4], r[3], r[5], r[0], r[1], r[2], r[7]),
        ),
    }

    for name, (cql, to_params) in inserts.items():
        stmt = session.prepare(cql)
        params = [to_params(r) for r in rows]
        execute_concurrent_with_args(session, stmt, params, concurrency=16, raise_on_first_error=True)
        print(f"{name:22s}: {len(params)} lignes")

    # Compteurs par chanson
    counts = df.groupby(["song_id", "event_type"]).size().reset_index(name="n")
    for etype, col in [("play", "plays"), ("skip", "skips"), ("add", "adds")]:
        stmt = session.prepare(f"UPDATE song_stats SET {col} = {col} + ? WHERE song_id = ?")
        sub = counts[counts["event_type"] == etype]
        params = [(int(n), sid) for sid, n in zip(sub["song_id"], sub["n"])]
        execute_concurrent_with_args(session, stmt, params, concurrency=64, raise_on_first_error=True)
    print(f"song_stats            : {counts['song_id'].nunique()} chansons")

    cluster.shutdown()


if __name__ == "__main__":
    main()
