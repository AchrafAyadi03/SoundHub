// Source audio + pochette d'une chanson, avec chaîne de secours :
//   1) fichier local (api/media/index.json)  ->  <audio>
//   2) embed Spotify (le song_id du dataset = id de piste Spotify)
//   3) rien
// Les fichiers locaux sont servis par server.js sous /api/media-files (voir README).

const express = require('express');
const fs = require('fs');
const path = require('path');

const MEDIA_DIR = process.env.MEDIA_DIR || path.join(__dirname, '..', '..', 'media');
const SONG_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const SPOTIFY_ID_RE = /^[A-Za-z0-9]{22}$/;

// Relu à chaque requête : tu peux ajouter des fichiers sans redémarrer l'API.
function loadIndex() {
  try {
    return JSON.parse(fs.readFileSync(path.join(MEDIA_DIR, 'index.json'), 'utf8'));
  } catch {
    return {};
  }
}

const coverCache = new Map();
async function spotifyCover(id) {
  if (coverCache.has(id)) return coverCache.get(id);
  try {
    const r = await fetch(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/track/${id}`)}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (r.ok) {
      const url = (await r.json()).thumbnail_url || null;
      if (url) coverCache.set(id, url); // on ne met en cache que les succès
      return url;
    }
  } catch {
    /* réseau indisponible : pas de pochette, la lecture reste possible */
  }
  return null;
}

const fileUrl = (name) => `/api/media-files/${encodeURIComponent(path.basename(name))}`;

const router = express.Router();

router.get('/:songId', async (req, res) => {
  const id = req.params.songId;
  if (!SONG_ID_RE.test(id)) return res.status(400).json({ error: 'song_id invalide' });

  const isSpotify = SPOTIFY_ID_RE.test(id);
  const entry = loadIndex()[id];

  if (entry && entry.file && fs.existsSync(path.join(MEDIA_DIR, path.basename(entry.file)))) {
    const cover = entry.cover ? fileUrl(entry.cover) : isSpotify ? await spotifyCover(id) : null;
    return res.json({ song_id: id, source: 'local', audio_url: fileUrl(entry.file), cover_url: cover });
  }

  if (isSpotify) {
    return res.json({
      song_id: id,
      source: 'spotify',
      embed_url: `https://open.spotify.com/embed/track/${id}`,
      cover_url: await spotifyCover(id),
    });
  }

  res.json({ song_id: id, source: 'none' });
});

module.exports = { router, MEDIA_DIR };
