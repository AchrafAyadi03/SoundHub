/* =====================================================================
 * SoundHub API : server.js (version complète, commentée)
 * ---------------------------------------------------------------------
 * Ce serveur Express regroupe :
 *   - l'authentification (MongoDB + Redis + JWT)
 *   - le catalogue de morceaux et d'artistes (fichiers CSV)
 *   - le suivi des écoutes et des statistiques (Cassandra)
 * ===================================================================== */

/* ---------------------------------------------------------------------
 * 1. CHARGEMENT DES VARIABLES D'ENVIRONNEMENT
 * Cas d'utilisation : lire le fichier .env (ports, URI des bases, secrets)
 * sans jamais écrire de mots de passe en dur dans le code.
 * Doit rester la TOUTE PREMIÈRE instruction du fichier.
 * ------------------------------------------------------------------- */
require('dotenv').config();

/* ---------------------------------------------------------------------
 * 2. IMPORTS DES DÉPENDANCES
 * Cas d'utilisation : déclarer une seule fois chaque module utilisé.
 * (Une double déclaration, par exemple de `cors`, provoque l'erreur
 * "Identifier has already been declared".)
 * ------------------------------------------------------------------- */
const express = require('express');                 // framework HTTP
const fs = require('fs');                           // lecture des fichiers CSV
const path = require('path');                       // construction des chemins
const cors = require('cors');                       // autoriser le front React
const helmet = require('helmet');                   // en-têtes HTTP de sécurité
const cookieParser = require('cookie-parser');      // lire le cookie "refresh"
const { Client, types } = require('cassandra-driver'); // base Cassandra
const { parse } = require('csv-parse/sync');        // lecture des CSV
const { createMediaRouter, MEDIA_DIR } = require('./src/routes/mediaRoutes');
const { router: artistRoutes } = require('./src/routes/artistRoutes');
const { createPlaylistRouter } = require('./src/routes/playlists');

/* ---------------------------------------------------------------------
 * 3. CONFIGURATION DE L'APPLICATION
 * Cas d'utilisation : définir le port d'écoute et le dossier contenant
 * les fichiers CSV importés (songs.csv, tracks.csv, users.csv).
 * ------------------------------------------------------------------- */
const app = express();
const PORT = Number(process.env.PORT || 3001);
const IMPORTS_DIR = process.env.IMPORTS_DIR || path.join(__dirname, '..', 'imports');

/* ---------------------------------------------------------------------
 * 4. CONNEXION À MONGODB ET REDIS
 * Cas d'utilisation :
 *   - MongoDB : stocker les comptes utilisateurs, playlists et posts.
 *   - Redis   : stocker les sessions (refresh tokens) et limiter les
 *               tentatives de connexion.
 * Si MongoDB est injoignable, l'API s'arrête pour éviter de tourner
 * sans authentification.
 * ------------------------------------------------------------------- */
const dbConnect = require('./src/config/db');
require('./src/config/redis'); // l'import suffit à ouvrir la connexion Redis

dbConnect().catch((err) => {
  console.error('Erreur de connexion à MongoDB:', err);
  process.exit(1);
});

/* ---------------------------------------------------------------------
 * 5. MIDDLEWARES GLOBAUX (à déclarer une seule fois chacun)
 * Cas d'utilisation : préparer chaque requête avant d'atteindre les routes.
 *   - helmet        : protège contre des attaques web courantes. On autorise
 *                     le chargement des pochettes et de l'audio depuis React
 *                     (port 5173) via crossOriginResourcePolicy.
 *   - cors          : autorise uniquement le front React à appeler l'API.
 *                     `credentials: true` est indispensable pour que le
 *                     cookie de session (refresh token) soit accepté.
 *   - express.json  : lit le corps JSON des requêtes (inscription, login...).
 *   - cookieParser  : rend le cookie "refresh" accessible via req.cookies.
 * ------------------------------------------------------------------- */
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

/* ---------------------------------------------------------------------
 * 6. ROUTES D'AUTHENTIFICATION
 * Cas d'utilisation : inscription, connexion, renouvellement de session,
 * déconnexion et profil connecté.
 * Endpoints : POST /api/auth/register | login | refresh | logout
 *             GET  /api/auth/me
 * ------------------------------------------------------------------- */
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/playlists', createPlaylistRouter((songId) => getSongs().byId.get(songId)));
const community = require('./src/routes/community');
community.setSongLookup((songId) => getSongs().byId.get(songId));
app.use('/api/community', community);

/* ---------------------------------------------------------------------
 * 7. FICHIERS MÉDIA ET ARTISTES
 * Cas d'utilisation :
 *   - /api/media-files : servir les pochettes et les fichiers audio
 *     stockés sur le disque (accessible aux invités).
 *   - /api/artists     : consulter les artistes du catalogue.
 * ------------------------------------------------------------------- */
app.use('/api/media-files', express.static(MEDIA_DIR));
app.use('/api/artists', artistRoutes);

/* ---------------------------------------------------------------------
 * 8. ROUTE D'ACCUEIL
 * Cas d'utilisation : vérifier rapidement que l'API est en marche.
 * ------------------------------------------------------------------- */
app.get('/', (req, res) => {
  res.json({ message: 'SoundHub API is running' });
});

/* ---------------------------------------------------------------------
 * 9. CLIENT CASSANDRA
 * Cas d'utilisation : enregistrer et consulter l'historique d'écoute
 * (lectures, passages, ajouts) à grande échelle.
 * Tous les paramètres viennent du .env avec des valeurs par défaut locales.
 * ------------------------------------------------------------------- */
const client = new Client({
  contactPoints: (process.env.CASSANDRA_CONTACT_POINTS || process.env.CASSANDRA_HOST || '127.0.0.1').split(','),
  protocolOptions: {
    port: Number(process.env.CASSANDRA_PORT || 9042),
  },
  localDataCenter: process.env.CASSANDRA_LOCAL_DATACENTER || process.env.CASSANDRA_DC || 'datacenter1',
  keyspace: process.env.CASSANDRA_KEYSPACE || 'soundhub',
});

/* ---------------------------------------------------------------------
 * 10. CONNEXION PARESSEUSE À CASSANDRA
 * Cas d'utilisation : l'API démarre même si Cassandra n'est pas encore
 * prête (elle met environ une minute à démarrer dans Docker). La connexion
 * n'est ouverte qu'au premier besoin, puis réutilisée.
 * ------------------------------------------------------------------- */
let connecting = null;
function db() {
  if (!connecting) {
    connecting = client.connect().then(() => client).catch((err) => {
      connecting = null; // permet de réessayer à la prochaine requête
      throw err;
    });
  }
  return connecting;
}

/* ---------------------------------------------------------------------
 * 11. CONSTANTES ET FONCTIONS UTILITAIRES
 * Cas d'utilisation : validations et conversions réutilisées par les routes.
 *   - EVENT_TYPES / COUNTER_COL : types d'événements autorisés et colonne
 *     de compteur correspondante dans song_stats.
 *   - DAY_RE   : valide une date au format YYYY-MM-DD.
 *   - limitOf  : borne le paramètre "limit" entre 1 et 500.
 *   - num      : convertit les compteurs Cassandra (Long) en nombre JS.
 *   - asyncH   : transmet les erreurs des routes async au gestionnaire final.
 *   - bad      : renvoie une réponse 400 avec un message d'erreur.
 * ------------------------------------------------------------------- */
const EVENT_TYPES = ['play', 'skip', 'add'];
const COUNTER_COL = { play: 'plays', skip: 'skips', add: 'adds' };
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const limitOf = (v, def = 50) => Math.min(Math.max(parseInt(v, 10) || def, 1), 500);
const num = (v) => (v == null ? 0 : typeof v === 'number' ? v : v.toNumber());
const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const bad = (res, msg) => res.status(400).json({ error: msg });

/* ---------------------------------------------------------------------
 * 12. CATALOGUE DE MORCEAUX (FICHIERS CSV)
 * Cas d'utilisation : fournir la liste des chansons depuis tracks.csv
 * (morceaux choisis, prioritaires) et songs.csv (catalogue complet),
 * sans passer par une base de données.
 * Le cache est invalidé automatiquement si un fichier CSV est modifié.
 * ------------------------------------------------------------------- */
let songsCache = null;
const emptySongs = { list: [], byId: new Map() };
const SONGS_FILE = path.join(IMPORTS_DIR, 'songs.csv');
const TRACKS_FILE = path.join(IMPORTS_DIR, 'tracks.csv');

// Retourne la première valeur non vide parmi plusieurs noms de colonnes possibles.
function firstValue(...values) {
  return values.find((value) => value != null && String(value).trim() !== '');
}

// Convertit une durée ("3:45", "225" ou "225000") en millisecondes.
function durationInMs(value) {
  const text = String(value || '').trim();
  if (!text) return 0;
  if (text.includes(':')) {
    const parts = text.split(':').map(Number);
    if (parts.every(Number.isFinite)) {
      return Math.round(parts.reduce((total, part) => total * 60 + part, 0) * 1000);
    }
    return 0;
  }
  const duration = Number(text);
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Math.round(duration >= 10000 ? duration : duration * 1000);
}

// Convertit une valeur en nombre, ou null si elle est vide ou invalide.
function optionalNumber(value) {
  if (value == null || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

// Normalise une liste CSV ("['A','B']" ou "A;B") en texte séparé par des ";".
function csvList(value) {
  const text = String(value || '').trim();
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item) => typeof item === 'string' || typeof item === 'number')
          .map((item) => String(item).trim())
          .filter(Boolean)
          .join(';');
      }
    } catch {
      // Valeur non JSON : on conserve le texte d'origine.
    }
  }
  return text;
}

// Empreinte (date de modification + taille) d'un fichier, pour savoir
// s'il faut recharger le cache. Retourne null si le fichier n'existe pas.
function fileSignature(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return { mtimeMs: stat.mtimeMs, size: stat.size };
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

// Transforme une ligne CSV (colonnes variables selon le jeu de données)
// en objet "chanson" au format unique utilisé par l'API et le front.
function normalizeSongRow(r) {
  const artists = csvList(firstValue(r.artist, r.artist_name, r.artists, r.artist_names));
  return {
    song_id: firstValue(r.id, r.song_id, r.track_id),
    track_name: firstValue(r.track_name, r.title, r.name) || '',
    artists: [artists, csvList(r.featuring)].filter(Boolean).join(';'),
    album_name: firstValue(r.album_name, r.album) || '',
    track_genre: csvList(firstValue(r.track_genre, r.genre, r.genres)).split(';')[0] || '',
    popularity: Number(r.popularity) || 0,
    duration_ms: durationInMs(firstValue(r.duration_ms, r.track_duration_ms, r.duration)),
    year: optionalNumber(firstValue(r.year, r.release_year)),
    mood: r.mood || '',
    energy: optionalNumber(r.energy),
    warmth: optionalNumber(r.warmth),
    tempo: optionalNumber(r.tempo),
    lrclib_id: firstValue(r.lrclibId, r.lrclib_id) || null,
    has_synced_lyrics: String(firstValue(r.hasSyncedLyrics, r.has_synced_lyrics) || '').toLowerCase() === 'true',
    audio_src: firstValue(r.audioSrc, r.audio_src) || '',
    cover: r.cover || '',
    data_status: r.status || '',
  };
}

// Charge (ou renvoie depuis le cache) la liste des chansons et un index par id.
// Les morceaux de tracks.csv passent avant ceux de songs.csv (triés par
// popularité), et les doublons sont supprimés.
function getSongs() {
  const signature = JSON.stringify([fileSignature(SONGS_FILE), fileSignature(TRACKS_FILE)]);
  if (songsCache && songsCache.signature === signature) return songsCache;

  try {
    const curatedRows = fileSignature(TRACKS_FILE)
      ? parse(fs.readFileSync(TRACKS_FILE), { columns: true, skip_empty_lines: true })
      : [];
    const catalogRows = fileSignature(SONGS_FILE)
      ? parse(fs.readFileSync(SONGS_FILE), { columns: true, skip_empty_lines: true })
      : [];
    const curated = curatedRows.map(normalizeSongRow).filter((song) => song.song_id);
    const catalog = catalogRows
      .map(normalizeSongRow)
      .filter((song) => song.song_id)
      .sort((a, b) => b.popularity - a.popularity);
    const ids = new Set();
    const list = [...curated, ...catalog].filter((song) => {
      if (ids.has(song.song_id)) return false;
      ids.add(song.song_id);
      return true;
    });
    songsCache = { list, byId: new Map(list.map((song) => [song.song_id, song])), signature };
  } catch (error) {
    console.error(`Impossible de charger le catalogue: ${error.message}`);
    return songsCache || emptySongs;
  }
  return songsCache;
}

/* ---------------------------------------------------------------------
 * 13. ROUTES MÉDIA (AUDIO ET PAROLES)
 * Cas d'utilisation : lire un morceau ou récupérer ses informations média
 * à partir de son identifiant, en s'appuyant sur le catalogue CSV.
 * ------------------------------------------------------------------- */
app.use('/api/media', createMediaRouter((songId) => getSongs().byId.get(songId)));

/* ---------------------------------------------------------------------
 * 14. UTILISATEURS DU JEU DE DONNÉES (CSV)
 * Cas d'utilisation : disposer d'utilisateurs de démonstration (users.csv)
 * pour simuler des écoutes dans Cassandra. Ils sont distincts des vrais
 * comptes créés via /api/auth (stockés dans MongoDB).
 * ------------------------------------------------------------------- */
let usersCache = null;
function getUsers() {
  if (!usersCache) {
    try {
      usersCache = parse(fs.readFileSync(path.join(IMPORTS_DIR, 'users.csv')), {
        columns: true,
        skip_empty_lines: true,
      });
    } catch {
      return [];
    }
  }
  return usersCache;
}

/* ---------------------------------------------------------------------
 * 15. FORMATAGE D'UN ÉVÉNEMENT
 * Cas d'utilisation : transformer une ligne Cassandra en objet JSON
 * lisible par le front, enrichi du titre et des artistes de la chanson.
 * ------------------------------------------------------------------- */
function mapEvent(r) {
  const s = getSongs().byId.get(r.song_id);
  return {
    event_id: String(r.event_id),
    user_id: r.user_id,
    song_id: r.song_id,
    track_name: s ? s.track_name : null,
    artists: s ? s.artists : null,
    event_type: r.event_type,
    event_ts: r.event_ts.toISOString(),
    duration_listened_ms: r.duration_listened_ms,
    device: r.device,
  };
}

/* ---------------------------------------------------------------------
 * 16. ÉTAT DE SANTÉ
 * Cas d'utilisation : vérifier que Cassandra répond (utile pour le
 * débogage et la supervision). GET /api/health
 * ------------------------------------------------------------------- */
app.get('/api/health', asyncH(async (req, res) => {
  const c = await db();
  const r = await c.execute('SELECT release_version FROM system.local');
  res.json({ ok: true, cassandra: r.rows[0].release_version });
}));

/* ---------------------------------------------------------------------
 * 17. RECHERCHE DE CHANSONS
 * Cas d'utilisation : barre de recherche du front. Accessible aux invités.
 * GET /api/songs?q=texte&limit=30
 * Cherche dans le titre, les artistes, l'album et l'ambiance (mood).
 * ------------------------------------------------------------------- */
app.get('/api/songs', (req, res) => {
  const q = String(req.query.q || '').toLowerCase().trim();
  const limit = limitOf(req.query.limit, 30);
  let list = getSongs().list;
  if (q) list = list.filter((song) => `${song.track_name} ${song.artists} ${song.album_name} ${song.mood}`.toLowerCase().includes(q));
  res.json(list.slice(0, limit));
});

/* ---------------------------------------------------------------------
 * 18. RECHERCHE D'UTILISATEURS DE DÉMONSTRATION
 * Cas d'utilisation : choisir un utilisateur du jeu de données pour
 * visualiser ou simuler son historique d'écoute.
 * GET /api/users?q=texte&limit=20
 * Seuls user_id, username et country sont exposés.
 * ------------------------------------------------------------------- */
app.get('/api/users', (req, res) => {
  const q = String(req.query.q || '').toLowerCase().trim();
  const limit = limitOf(req.query.limit, 20);
  let list = getUsers();
  if (q) list = list.filter((u) => `${u.user_id} ${u.username}`.toLowerCase().includes(q));
  res.json(list.slice(0, limit).map((u) => ({ user_id: u.user_id, username: u.username, country: u.country })));
});

/* ---------------------------------------------------------------------
 * 19. ENREGISTRER UN ÉVÉNEMENT D'ÉCOUTE (Cassandra)
 * Cas d'utilisation : chaque fois qu'un utilisateur écoute (play), passe
 * (skip) ou ajoute (add) un morceau, le front appelle cette route.
 * POST /api/events  { user_id, song_id, event_type, duration_listened_ms?, device? }
 * L'événement est écrit dans 4 tables (une par type de lecture : par
 * utilisateur, par utilisateur et type, par chanson et jour, journal global),
 * puis le compteur de la chanson est incrémenté.
 * ------------------------------------------------------------------- */
app.post('/api/events', asyncH(async (req, res) => {
  const { user_id, song_id, event_type } = req.body || {};
  const device = req.body.device || 'web';
  const listened = req.body.duration_listened_ms == null ? 0 : req.body.duration_listened_ms;
  if (!user_id || typeof user_id !== 'string') return bad(res, 'user_id requis');
  if (!song_id || typeof song_id !== 'string') return bad(res, 'song_id requis');
  if (!EVENT_TYPES.includes(event_type)) return bad(res, `event_type doit être : ${EVENT_TYPES.join(', ')}`);
  if (!Number.isInteger(listened) || listened < 0) return bad(res, 'duration_listened_ms doit être un entier >= 0');

  const c = await db();
  const ts = new Date();
  const day = ts.toISOString().slice(0, 10);
  const id = types.Uuid.random();

  await c.batch(
    [
      {
        query: 'INSERT INTO events_by_user (user_id, event_ts, event_id, song_id, event_type, duration_listened_ms, device) VALUES (?, ?, ?, ?, ?, ?, ?)',
        params: [user_id, ts, id, song_id, event_type, listened, device],
      },
      {
        query: 'INSERT INTO events_by_user_type (user_id, event_type, event_ts, event_id, song_id, duration_listened_ms, device) VALUES (?, ?, ?, ?, ?, ?, ?)',
        params: [user_id, event_type, ts, id, song_id, listened, device],
      },
      {
        query: 'INSERT INTO events_by_song_day (song_id, day, event_ts, event_id, user_id, event_type, duration_listened_ms, device) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        params: [song_id, day, ts, id, user_id, event_type, listened, device],
      },
      {
        query: 'INSERT INTO activity_log (day, event_ts, event_id, user_id, song_id, event_type, device) VALUES (?, ?, ?, ?, ?, ?, ?)',
        params: [day, ts, id, user_id, song_id, event_type, device],
      },
    ],
    { prepare: true }
  );
  // Les compteurs Cassandra ne peuvent pas être mélangés au batch ci-dessus.
  const col = COUNTER_COL[event_type];
  await c.execute(`UPDATE song_stats SET ${col} = ${col} + 1 WHERE song_id = ?`, [song_id], { prepare: true });

  res.status(201).json({
    event_id: String(id),
    user_id,
    song_id,
    event_type,
    event_ts: ts.toISOString(),
    duration_listened_ms: listened,
    device,
  });
}));

/* ---------------------------------------------------------------------
 * 20. HISTORIQUE D'ÉCOUTE D'UN UTILISATEUR
 * Cas d'utilisation : page « Mon historique » ou profil d'un utilisateur.
 * GET /api/users/:userId/events?type=play&from=...&to=...&limit=50
 * Filtres optionnels : type d'événement, période (dates ISO), limite.
 * ------------------------------------------------------------------- */
app.get('/api/users/:userId/events', asyncH(async (req, res) => {
  const { type, from, to } = req.query;
  if (type && !EVENT_TYPES.includes(type)) return bad(res, 'type invalide');
  const params = [req.params.userId];
  let cql;
  if (type) {
    cql = 'SELECT * FROM events_by_user_type WHERE user_id = ? AND event_type = ?';
    params.push(type);
  } else {
    cql = 'SELECT * FROM events_by_user WHERE user_id = ?';
  }
  for (const [name, op, value] of [['from', '>=', from], ['to', '<', to]]) {
    if (!value) continue;
    const d = new Date(value);
    if (isNaN(d)) return bad(res, `date "${name}" invalide`);
    cql += ` AND event_ts ${op} ?`;
    params.push(d);
  }
  cql += ' LIMIT ?';
  params.push(limitOf(req.query.limit));

  const c = await db();
  const r = await c.execute(cql, params, { prepare: true });
  res.json(r.rows.map(mapEvent));
}));

/* ---------------------------------------------------------------------
 * 21. ÉVÉNEMENTS D'UNE CHANSON POUR UN JOUR
 * Cas d'utilisation : analyser qui a écouté un morceau précis un jour donné.
 * GET /api/songs/:songId/events?day=YYYY-MM-DD&limit=50
 * ------------------------------------------------------------------- */
app.get('/api/songs/:songId/events', asyncH(async (req, res) => {
  const { day } = req.query;
  if (!DAY_RE.test(day || '')) return bad(res, 'paramètre day requis (YYYY-MM-DD)');
  const c = await db();
  const r = await c.execute(
    'SELECT * FROM events_by_song_day WHERE song_id = ? AND day = ? LIMIT ?',
    [req.params.songId, day, limitOf(req.query.limit)],
    { prepare: true }
  );
  res.json(r.rows.map(mapEvent));
}));

/* ---------------------------------------------------------------------
 * 22. COMPTEURS D'UNE CHANSON
 * Cas d'utilisation : afficher le nombre d'écoutes, de passages et
 * d'ajouts d'un morceau (fiche du morceau).
 * GET /api/songs/:songId/stats
 * ------------------------------------------------------------------- */
app.get('/api/songs/:songId/stats', asyncH(async (req, res) => {
  const c = await db();
  const r = await c.execute('SELECT * FROM song_stats WHERE song_id = ?', [req.params.songId], { prepare: true });
  const row = r.first();
  res.json({
    song_id: req.params.songId,
    plays: row ? num(row.plays) : 0,
    skips: row ? num(row.skips) : 0,
    adds: row ? num(row.adds) : 0,
  });
}));

/* ---------------------------------------------------------------------
 * 23. JOURNAL D'ACTIVITÉ D'UN JOUR
 * Cas d'utilisation : tableau de bord d'administration montrant toute
 * l'activité de la plateforme un jour donné.
 * GET /api/activity?day=YYYY-MM-DD&limit=50
 * ------------------------------------------------------------------- */
app.get('/api/activity', asyncH(async (req, res) => {
  const { day } = req.query;
  if (!DAY_RE.test(day || '')) return bad(res, 'paramètre day requis (YYYY-MM-DD)');
  const c = await db();
  const r = await c.execute('SELECT * FROM activity_log WHERE day = ? LIMIT ?', [day, limitOf(req.query.limit)], { prepare: true });
  res.json(r.rows.map(mapEvent));
}));

/* ---------------------------------------------------------------------
 * 24. TOP DES CHANSONS
 * Cas d'utilisation : classement des morceaux les plus écoutés (page
 * d'accueil ou « Tendances »). GET /api/stats/top?limit=10
 * Remarque : parcourt toute la table song_stats, acceptable pour un
 * mini-projet. En production, on maintiendrait une table de classement.
 * ------------------------------------------------------------------- */
app.get('/api/stats/top', asyncH(async (req, res) => {
  const limit = limitOf(req.query.limit, 10);
  const c = await db();
  const all = [];
  await new Promise((resolve, reject) => {
    c.eachRow(
      'SELECT song_id, plays, skips, adds FROM song_stats',
      [],
      { prepare: true, fetchSize: 5000, autoPage: true },
      (n, row) => all.push({ song_id: row.song_id, plays: num(row.plays), skips: num(row.skips), adds: num(row.adds) }),
      (err) => (err ? reject(err) : resolve())
    );
  });
  const byId = getSongs().byId;
  all.sort((a, b) => b.plays - a.plays);
  res.json(
    all.slice(0, limit).map((s) => {
      const song = byId.get(s.song_id);
      return { ...s, track_name: song ? song.track_name : null, artists: song ? song.artists : null };
    })
  );
}));

/* ---------------------------------------------------------------------
 * 25. GESTIONNAIRE D'ERREURS FINAL
 * Cas d'utilisation : renvoyer une réponse JSON claire quand une route
 * échoue, au lieu d'une page d'erreur HTML. Cas particulier : Cassandra
 * injoignable renvoie un 503 avec la marche à suivre.
 * Doit rester APRÈS toutes les routes.
 * ------------------------------------------------------------------- */
app.use((err, req, res, next) => {
  console.error(err.message);
  if (err.name === 'NoHostAvailableError') {
    return res.status(503).json({ error: 'Cassandra injoignable (docker compose up -d, puis attendre ~1 min)' });
  }
  res.status(500).json({ error: err.message });
});

/* ---------------------------------------------------------------------
 * 26. DÉMARRAGE DU SERVEUR
 * Cas d'utilisation : ouvrir le port d'écoute pour recevoir les requêtes
 * du front React et des outils de test (Postman, Thunder Client).
 * ------------------------------------------------------------------- */
app.listen(PORT, () => console.log(`API SoundHub sur http://localhost:${PORT}`));