require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { Client, types } = require('cassandra-driver');
const { parse } = require('csv-parse/sync');
const { router: mediaRoutes, MEDIA_DIR } = require('./src/routes/mediaRoutes');
const { router: artistRoutes } = require('./src/routes/artistRoutes');

const app = express();
const PORT = Number(process.env.PORT || 3001);
const IMPORTS_DIR = process.env.IMPORTS_DIR || path.join(__dirname, '..', 'imports');

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());
app.use('/api/media-files', express.static(MEDIA_DIR));
app.use('/api/media', mediaRoutes);
app.use('/api/artists', artistRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'SoundHub API is running' });
});

const client = new Client({
  contactPoints: (process.env.CASSANDRA_CONTACT_POINTS || process.env.CASSANDRA_HOST || '127.0.0.1').split(','),
  protocolOptions: {
    port: Number(process.env.CASSANDRA_PORT || 9042),
  },
  localDataCenter: process.env.CASSANDRA_LOCAL_DATACENTER || process.env.CASSANDRA_DC || 'datacenter1',
  keyspace: process.env.CASSANDRA_KEYSPACE || 'soundhub',
});

// Connexion paresseuse : l'API démarre même si Cassandra n'est pas encore prête.
let connecting = null;
function db() {
  if (!connecting) {
    connecting = client.connect().then(() => client).catch((err) => {
      connecting = null;
      throw err;
    });
  }
  return connecting;
}

const EVENT_TYPES = ['play', 'skip', 'add'];
const COUNTER_COL = { play: 'plays', skip: 'skips', add: 'adds' };
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const limitOf = (v, def = 50) => Math.min(Math.max(parseInt(v, 10) || def, 1), 500);
const num = (v) => (v == null ? 0 : typeof v === 'number' ? v : v.toNumber());
const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const bad = (res, msg) => res.status(400).json({ error: msg });

// ---------- Données de remplacement (CSV) ----------
let songsCache = null;
function getSongs() {
  if (!songsCache) {
    try {
      const rows = parse(fs.readFileSync(path.join(IMPORTS_DIR, 'songs.csv')), {
        columns: true,
        skip_empty_lines: true,
      });
      const list = rows
        .map((r) => ({
          song_id: r.song_id,
          track_name: r.track_name,
          artists: r.artists,
          album_name: r.album_name,
          track_genre: r.track_genre,
          popularity: Number(r.popularity) || 0,
          duration_ms: Number(r.duration_ms) || 0,
        }))
        .sort((a, b) => b.popularity - a.popularity);
      songsCache = { list, byId: new Map(list.map((s) => [s.song_id, s])) };
    } catch {
      return { list: [], byId: new Map() }; // pas mis en cache : réessaie après génération des CSV
    }
  }
  return songsCache;
}

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

app.get('/api/health', asyncH(async (req, res) => {
  const c = await db();
  const r = await c.execute('SELECT release_version FROM system.local');
  res.json({ ok: true, cassandra: r.rows[0].release_version });
}));

// ---------- Catalogue / utilisateurs (remplacement de MongoDB) ----------
app.get('/api/songs', (req, res) => {
  const q = String(req.query.q || '').toLowerCase().trim();
  const limit = limitOf(req.query.limit, 30);
  let list = getSongs().list;
  if (q) list = list.filter((s) => `${s.track_name} ${s.artists}`.toLowerCase().includes(q));
  res.json(list.slice(0, limit));
});

app.get('/api/users', (req, res) => {
  const q = String(req.query.q || '').toLowerCase().trim();
  const limit = limitOf(req.query.limit, 20);
  let list = getUsers();
  if (q) list = list.filter((u) => `${u.user_id} ${u.username}`.toLowerCase().includes(q));
  res.json(list.slice(0, limit).map((u) => ({ user_id: u.user_id, username: u.username, country: u.country })));
});

// ---------- Événements (Cassandra) ----------

// Enregistrer un événement : écrit dans les 4 tables (batch) + compteur de la chanson.
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

// Historique d'un utilisateur, filtres : type, from, to (ISO), limit.
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

// Événements d'une chanson pour un jour donné.
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

// Compteurs d'une chanson.
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

// Journal d'activité d'un jour.
app.get('/api/activity', asyncH(async (req, res) => {
  const { day } = req.query;
  if (!DAY_RE.test(day || '')) return bad(res, 'paramètre day requis (YYYY-MM-DD)');
  const c = await db();
  const r = await c.execute('SELECT * FROM activity_log WHERE day = ? LIMIT ?', [day, limitOf(req.query.limit)], { prepare: true });
  res.json(r.rows.map(mapEvent));
}));

// Top chansons : parcours complet de song_stats (acceptable pour un mini-projet,
// pas pour de la production : en vrai on maintiendrait une table de classement).
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

app.use((err, req, res, next) => {
  console.error(err.message);
  if (err.name === 'NoHostAvailableError') {
    return res.status(503).json({ error: 'Cassandra injoignable (docker compose up -d, puis attendre ~1 min)' });
  }
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => console.log(`API SoundHub sur http://localhost:${PORT}`));
