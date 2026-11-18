const express = require('express');

const router = express.Router();
const artistCache = new Map();

router.get('/image', async (req, res) => {
  const suppliedName = typeof req.query.name === 'string' ? req.query.name : '';
  const name = suppliedName.split(';')[0].trim();
  if (!name || name.length > 100) {
    return res.status(400).json({ error: 'name doit contenir entre 1 et 100 caractères' });
  }

  if (artistCache.has(name)) return res.json({ name, image_url: artistCache.get(name) });

  try {
    const url = new URL('https://api.deezer.com/search/artist');
    url.searchParams.set('q', name);
    url.searchParams.set('limit', '1');
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) return res.json({ name, image_url: null });

    const payload = await response.json();
    const artist = Array.isArray(payload?.data) ? payload.data[0] : null;
    const imageUrl = typeof artist?.picture_xl === 'string' && artist.picture_xl
      ? artist.picture_xl
      : typeof artist?.picture_big === 'string' && artist.picture_big
        ? artist.picture_big
        : null;
    artistCache.set(name, imageUrl);
    return res.json({ name, image_url: imageUrl });
  } catch {
    return res.json({ name, image_url: null });
  }
});

module.exports = { router };
