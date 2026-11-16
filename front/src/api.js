// Client de l'API SoundHub (voir api/server.js).

function qs(params = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== '' && v != null) p.set(k, v);
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

async function request(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

export const api = {
  songs: (q, limit = 30) => request(`/api/songs${qs({ q, limit })}`),
  userEvents: (userId, params) => request(`/api/users/${encodeURIComponent(userId)}/events${qs(params)}`),
  songEvents: (songId, day, limit = 50) =>
    request(`/api/songs/${encodeURIComponent(songId)}/events${qs({ day, limit })}`),
  songStats: (songId) => request(`/api/songs/${encodeURIComponent(songId)}/stats`),
  activity: (day, limit = 50) => request(`/api/activity${qs({ day, limit })}`),
  topSongs: (limit = 10) => request(`/api/stats/top${qs({ limit })}`),
  addEvent: (event) =>
    request('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    }),
};
