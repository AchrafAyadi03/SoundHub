const LRCLIB_API = 'https://lrclib.net/api';
const CACHE_PREFIX = 'soundhub-lyrics-v1:';
const FOUND_TTL = 1000 * 60 * 60 * 24 * 30;
const EMPTY_TTL = 1000 * 60 * 60 * 8;

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function makeCacheKey({ title, artist }) {
  return `${CACHE_PREFIX}${normalize(artist)}|${normalize(title)}`;
}

function readCache(key) {
  try {
    const cached = JSON.parse(localStorage.getItem(key) || 'null');
    if (!cached || cached.expiresAt <= Date.now()) return { hit: false };
    return { hit: true, value: cached.value };
  } catch {
    return { hit: false };
  }
}

function writeCache(key, value) {
  try {
    const ttl = value ? FOUND_TTL : EMPTY_TTL;
    localStorage.setItem(key, JSON.stringify({ value, expiresAt: Date.now() + ttl }));
  } catch {
    // Lyrics remain available for the current view if storage is unavailable.
  }
}

async function requestJson(url, signal) {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`LRCLIB (${response.status})`);
  return response.json();
}

function hasLyrics(result) {
  return Boolean(result?.syncedLyrics || result?.plainLyrics || result?.instrumental);
}

function chooseMatch(results, { title, artist }) {
  if (!Array.isArray(results)) return null;
  const expectedTitle = normalize(title);
  const expectedArtist = normalize(artist);
  return results.find((result) =>
    normalize(result.trackName) === expectedTitle
    && normalize(result.artistName).includes(expectedArtist))
    || results.find((result) => normalize(result.trackName) === expectedTitle)
    || null;
}

export async function fetchLyrics({ title, artist, album, duration }, signal) {
  const cacheKey = makeCacheKey({ title, artist });
  const cached = readCache(cacheKey);
  if (cached.hit) return cached.value;

  const exactParams = new URLSearchParams({ track_name: title, artist_name: artist });
  if (album) exactParams.set('album_name', album);
  if (Number.isFinite(duration) && duration > 0) exactParams.set('duration', String(Math.round(duration)));

  let lyrics = null;
  let hadNetworkError = false;
  try {
    lyrics = await requestJson(`${LRCLIB_API}/get?${exactParams}`, signal);
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    hadNetworkError = true;
  }

  if (!hasLyrics(lyrics)) {
    try {
      const searchParams = new URLSearchParams({ track_name: title, artist_name: artist });
      if (album) searchParams.set('album_name', album);
      if (Number.isFinite(duration) && duration > 0) searchParams.set('duration', String(Math.round(duration)));
      const matches = await requestJson(`${LRCLIB_API}/search?${searchParams}`, signal);
      const match = chooseMatch(matches, { title, artist });
      if (match?.id) {
        lyrics = await requestJson(`${LRCLIB_API}/get/${encodeURIComponent(match.id)}`, signal);
      } else if (hasLyrics(match)) {
        lyrics = match;
      }
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      hadNetworkError = true;
    }
  }

  const result = hasLyrics(lyrics) ? lyrics : null;
  if (!result && hadNetworkError) throw new Error('Impossible de joindre LRCLIB.');
  if (result || !hadNetworkError) writeCache(cacheKey, result);
  return result;
}

export function parseLRC(value) {
  if (!value) return [];
  const entries = [];
  const timestampPattern = /\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g;
  for (const rawLine of value.split(/\r?\n/)) {
    const timestamps = [...rawLine.matchAll(timestampPattern)];
    if (!timestamps.length) continue;
    const text = rawLine.replace(timestampPattern, '').trim();
    timestamps.forEach(([, minutes, seconds, fraction = '0']) => {
      entries.push({
        time: Number(minutes) * 60 + Number(seconds) + Number(`0.${fraction}`),
        text,
      });
    });
  }
  return entries.sort((first, second) => first.time - second.time);
}
