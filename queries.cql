-- Requêtes de démonstration (cqlsh) : docker exec -it soundhub-cassandra cqlsh
USE soundhub;

-- Q1 : les 20 derniers événements d'un utilisateur
SELECT * FROM events_by_user WHERE user_id = 'U00001' LIMIT 20;

-- Q1b : événements d'un utilisateur sur une période
SELECT * FROM events_by_user
WHERE user_id = 'U00001'
  AND event_ts >= '2026-10-01' AND event_ts < '2026-11-01';

-- Q2 : uniquement les écoutes (play) d'un utilisateur
SELECT * FROM events_by_user_type WHERE user_id = 'U00001' AND event_type = 'play' LIMIT 20;

-- Q3 : événements d'une chanson un jour donné (remplacer <song_id> par un id de songs.csv)
SELECT * FROM events_by_song_day WHERE song_id = '<song_id>' AND day = '2026-10-30';

-- Q4 : journal d'activité d'un jour
SELECT * FROM activity_log WHERE day = '2026-10-30' LIMIT 50;

-- Q5 : statistiques d'une chanson
SELECT * FROM song_stats WHERE song_id = '<song_id>';

-- Enregistrer un nouvel événement (à répéter dans les 4 tables d'événements, voir l'API)
INSERT INTO events_by_user (user_id, event_ts, event_id, song_id, event_type, duration_listened_ms, device)
VALUES ('U00001', toTimestamp(now()), uuid(), '<song_id>', 'play', 180000, 'web');
