/* =====================================================================
 * src/api.js : client de l'API SoundHub (version fusionnée)
 * ---------------------------------------------------------------------
 * Contient :
 *   1. la couche HTTP avec authentification (token en mémoire, cookie
 *      "refresh", renouvellement automatique)  -> http(), refreshSession()
 *   2. l'objet `api` : tes méthodes existantes (songs, userEvents, ...)
 *      + les nouvelles méthodes auth / playlists / communauté.
 * Les URL sont relatives (/api) : elles passent par le proxy Vite, donc le
 * cookie "refresh" est envoyé sans configuration CORS particulière.
 * ===================================================================== */
const BASE = import.meta.env.VITE_API_URL || '/api';

/* ---------------------------------------------------------------------
 * 1. COUCHE HTTP AVEC AUTHENTIFICATION
 * ------------------------------------------------------------------- */
let accessToken = null;        // access token courant (valable 15 min), gardé en mémoire
let onAuthLost = () => {};     // appelé quand la session ne peut plus être renouvelée

export const setAccessToken = (token) => { accessToken = token; };
export const setAuthLostHandler = (fn) => { onAuthLost = fn; };

/* Renouvelle la session grâce au cookie "refresh".
 * Cas d'utilisation : restaurer la connexion au chargement de la page, ou
 * remplacer un access token expiré. Les appels simultanés partagent la même
 * requête (le serveur change le refresh token à chaque usage). */
let refreshing = null;
export function refreshSession() {
  if (!refreshing) {
    refreshing = fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Session expirée');
        const data = await res.json();
        accessToken = data.accessToken;
        return data; // { accessToken, user }
      })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

/* Appel générique : http('/playlists/mine'), http('/auth/login', { method: 'POST', body })
 * Ajoute le token s'il existe, renouvelle la session sur un 401 (sauf routes /auth),
 * et lève une Error dont le message vient du serveur. */
export async function http(path, { method = 'GET', body, retry = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    try {
      await refreshSession();
      return http(path, { method, body, retry: false });
    } catch {
      accessToken = null;
      onAuthLost();
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Erreur ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Construit une query string en ignorant les valeurs vides.
function qs(params = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== '' && v != null) p.set(k, v);
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

const enc = encodeURIComponent;

/* ---------------------------------------------------------------------
 * 2. OBJET `api`
 * ------------------------------------------------------------------- */
export const api = {
  /* ----- Catalogue, écoutes et statistiques (existant, inchangé) ----- */
  songs: (q, limit = 30) => http(`/songs${qs({ q, limit })}`),
  userEvents: (userId, params) => http(`/users/${enc(userId)}/events${qs(params)}`),
  songEvents: (songId, day, limit = 50) => http(`/songs/${enc(songId)}/events${qs({ day, limit })}`),
  songStats: (songId) => http(`/songs/${enc(songId)}/stats`),
  activity: (day, limit = 50) => http(`/activity${qs({ day, limit })}`),
  topSongs: (limit = 10) => http(`/stats/top${qs({ limit })}`),
  artistImage: (name) => http(`/artists/image${qs({ name })}`),
  addEvent: (event) => http('/events', { method: 'POST', body: event }),

  /* ----- Authentification ----- */
  register: (username, email, password) => http('/auth/register', { method: 'POST', body: { username, email, password } }),
  login: (email, password) => http('/auth/login', { method: 'POST', body: { email, password } }),
  logout: () => http('/auth/logout', { method: 'POST' }),
  me: () => http('/auth/me'),

  /* ----- Playlists ----- */
  publicPlaylists: (params) => http(`/playlists/public${qs(params)}`),
  myPlaylists: () => http('/playlists/mine'),
  playlist: (id) => http(`/playlists/${enc(id)}`),
  sharedPlaylist: (token) => http(`/playlists/shared/${enc(token)}`),
  createPlaylist: (data) => http('/playlists', { method: 'POST', body: data }),
  updatePlaylist: (id, data) => http(`/playlists/${enc(id)}`, { method: 'PUT', body: data }),
  deletePlaylist: (id) => http(`/playlists/${enc(id)}`, { method: 'DELETE' }),
  addTrack: (id, trackId) => http(`/playlists/${enc(id)}/tracks`, { method: 'POST', body: { trackId } }),
  removeTrack: (id, trackId) => http(`/playlists/${enc(id)}/tracks/${enc(trackId)}`, { method: 'DELETE' }),
  sharePlaylist: (id) => http(`/playlists/${enc(id)}/share`, { method: 'POST' }),
  unsharePlaylist: (id) => http(`/playlists/${enc(id)}/share`, { method: 'DELETE' }),

  /* ----- Communauté ----- */
  feed: (params) => http(`/community${qs(params)}`),
  post: (id) => http(`/community/posts/${enc(id)}`),
  createPost: (data) => http('/community/posts', { method: 'POST', body: data }),
  deletePost: (id) => http(`/community/posts/${enc(id)}`, { method: 'DELETE' }),
  toggleLike: (id) => http(`/community/posts/${enc(id)}/like`, { method: 'POST' }),
  addComment: (id, content) => http(`/community/posts/${enc(id)}/comments`, { method: 'POST', body: { content } }),
  deleteComment: (id, commentId) => http(`/community/posts/${enc(id)}/comments/${enc(commentId)}`, { method: 'DELETE' }),
};