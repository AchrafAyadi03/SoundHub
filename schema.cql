-- SoundHub : schéma Cassandra (événements utilisateurs + journal d'activité)
-- Modèle conçu à partir des requêtes : une table par type d'accès.

CREATE KEYSPACE IF NOT EXISTS soundhub
  WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1};

USE soundhub;

-- Q1 : historique d'un utilisateur (plus récent d'abord), avec filtre par période
CREATE TABLE IF NOT EXISTS events_by_user (
  user_id text,
  event_ts timestamp,
  event_id uuid,
  song_id text,
  event_type text,              -- play | skip | add
  duration_listened_ms int,
  device text,
  PRIMARY KEY ((user_id), event_ts, event_id)
) WITH CLUSTERING ORDER BY (event_ts DESC, event_id DESC);

-- Q2 : historique d'un utilisateur filtré par type d'événement
CREATE TABLE IF NOT EXISTS events_by_user_type (
  user_id text,
  event_type text,
  event_ts timestamp,
  event_id uuid,
  song_id text,
  duration_listened_ms int,
  device text,
  PRIMARY KEY ((user_id, event_type), event_ts, event_id)
) WITH CLUSTERING ORDER BY (event_ts DESC, event_id DESC);

-- Q3 : événements d'une chanson pour un jour donné (day = 'YYYY-MM-DD')
CREATE TABLE IF NOT EXISTS events_by_song_day (
  song_id text,
  day text,
  event_ts timestamp,
  event_id uuid,
  user_id text,
  event_type text,
  duration_listened_ms int,
  device text,
  PRIMARY KEY ((song_id, day), event_ts, event_id)
) WITH CLUSTERING ORDER BY (event_ts DESC, event_id DESC);

-- Q4 : journal d'activité global d'un jour (partition = jour)
CREATE TABLE IF NOT EXISTS activity_log (
  day text,
  event_ts timestamp,
  event_id uuid,
  user_id text,
  song_id text,
  event_type text,
  device text,
  PRIMARY KEY ((day), event_ts, event_id)
) WITH CLUSTERING ORDER BY (event_ts DESC, event_id DESC);

-- Q5 : compteurs par chanson (pour les statistiques du front)
CREATE TABLE IF NOT EXISTS song_stats (
  song_id text PRIMARY KEY,
  plays counter,
  skips counter,
  adds counter
);
