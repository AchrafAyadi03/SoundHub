# SoundHub : partie Cassandra + front React

Cassandra stocke les **événements utilisateurs** (play / skip / add) et le **journal d'activité**.
Les identifiants `user_id` (ex. `U00001`) et `song_id` (= `track_id` du dataset Spotify) sont partagés avec MongoDB, Redis et Neo4j.

```
soundhub/
├── docker-compose.yml      Cassandra 4.1 (port 9042)
├── schema.cql              keyspace + 5 tables
├── generate_data.py        dataset Spotify -> songs.csv, users.csv, events.csv (SEED = 2026)
├── load_cassandra.py       crée le schéma et charge events.csv
├── queries.cql             requêtes de démonstration (cqlsh)
├── api/                    API REST Express + cassandra-driver (port 3001)
└── front/                  front React + Vite (port 5173)
```

## Démarrage

```bash
# 1. Cassandra (attendre ~1 min que le conteneur soit "healthy")
docker compose up -d
docker compose ps

# 2. Données : place dataset.csv (Kaggle) à la racine, puis
pip install -r requirements.txt          # Python 3.10 ou 3.11 recommandé
python generate_data.py --dataset dataset.csv --out imports --users 1000 --events 100000
python load_cassandra.py --events imports/events.csv

# 3. API (terminal 2)
cd api && npm install && npm start       # http://localhost:3001/api/health

# 4. Front (terminal 3)
cd front && npm install && npm run dev   # http://localhost:5173
```

### Sources audio locales

Le lecteur `TrackPlayer` interroge automatiquement `/api/media/:songId`. Pour
associer un fichier local à une chanson, placez-le dans `api/media/` puis ajoutez
son nom dans `api/media/index.json` avec son `song_id` Spotify. Le serveur expose
ces fichiers sous `/api/media-files`. Sans fichier, le lecteur utilise l’embed
Spotify lorsque l’identifiant est valide.

Les titres de `imports/tracks.csv` sont ajoutés en tête du catalogue. Les colonnes
`audioSrc` et `cover` sont utilisées par `/api/media/:songId` lorsqu’elles sont
renseignées ; sans source audio (ou entrée dans `api/media/index.json`), le titre
reste visible et recherchable mais ne peut pas être lu.


## Modèle Cassandra (une table par requête)

| Table | Clé de partition | Clustering | Usage |
|---|---|---|---|
| `events_by_user` | `user_id` | `event_ts DESC, event_id` | historique d'un utilisateur |
| `events_by_user_type` | `(user_id, event_type)` | `event_ts DESC, event_id` | historique filtré par type |
| `events_by_song_day` | `(song_id, day)` | `event_ts DESC, event_id` | événements d'une chanson par jour |
| `activity_log` | `day` | `event_ts DESC, event_id` | journal d'activité global |
| `song_stats` | `song_id` | - | compteurs plays / skips / adds |

Un événement est écrit dans les 4 premières tables (dénormalisation propre à Cassandra), puis le compteur de la chanson est incrémenté.

## API

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/api/events` | enregistrer un événement (`user_id`, `song_id`, `event_type`, `duration_listened_ms`, `device`) |
| GET | `/api/users/:id/events?type=&from=&to=&limit=` | historique d'un utilisateur |
| GET | `/api/songs/:id/events?day=YYYY-MM-DD` | événements d'une chanson un jour donné |
| GET | `/api/songs/:id/stats` | compteurs d'une chanson |
| GET | `/api/activity?day=YYYY-MM-DD` | journal d'activité d'un jour |
| GET | `/api/stats/top?limit=10` | top chansons (parcours de `song_stats`) |
| GET | `/api/songs?q=`, `/api/users?q=` | **remplacement temporaire de MongoDB** (lit `imports/*.csv`) |

`/api/songs` fusionne `imports/tracks.csv` et `imports/songs.csv`, accepte les variantes de colonnes des deux fichiers (listes d’artistes JSON incluses) et recharge le catalogue lorsque l’un des fichiers change.

## Pages du front

- **Historique** : événements d'un utilisateur, filtres type / période.
- **Catalogue** : recherche de chansons, boutons Écouter / Passer / Ajouter qui écrivent dans Cassandra.
- **Journal d'activité** : activité globale d'un jour.
- **Statistiques** : top 10 des chansons, puis événements d'une chanson pour un jour donné.

## Intégration avec le groupe
- Un seul `users.csv` et un seul `songs.csv` pour les 4 bases (même script, même seed).
- Quand la partie MongoDB sera prête, remplacer `/api/songs` et `/api/users` par ses endpoints : le front ne change pas.
- Le jour par défaut du front est `2026-10-31` (`front/src/config.js`), le dernier jour des données générées.
