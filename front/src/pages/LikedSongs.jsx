/* =====================================================================
 * src/pages/LikedSongs.jsx : titres likés
 * ---------------------------------------------------------------------
 * ATTENTION : je ne connais pas ton API de likes. Adapte la fonction
 * `loadLikes` (et les noms de champs track_name / artist_name) à ton backend.
 * ===================================================================== */
import { useEffect, useState } from 'react';
import { Heart, Play } from 'lucide-react';
import { api } from '../api.js';

async function loadLikes(userId) {
  // TODO : remplace par ton vrai appel (ex. api.getLikedSongs, api.getUserLikes…)
  if (typeof api.getLikedSongs !== 'function') return [];
  const data = await api.getLikedSongs(userId);
  return Array.isArray(data) ? data : data?.items || [];
}

export default function LikedSongs({ userId, onEvent }) {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadLikes(userId)
      .then((items) => { if (!cancelled) setSongs(items); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  return (
    <section className="liked-page">
      <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Heart size={24} /> Titres likés
      </h1>

      {loading && <p>Chargement…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && songs.length === 0 && (
        <p>Aucun titre liké pour l'instant. Likez des morceaux depuis le catalogue pour les retrouver ici.</p>
      )}

      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
        {songs.map((song) => (
          <li
            key={song.song_id || song.id}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.05)' }}
          >
            <button type="button" onClick={() => onEvent(song, 'play', songs)} aria-label={`Lire ${song.track_name || song.title}`}>
              <Play size={16} />
            </button>
            <div style={{ minWidth: 0 }}>
              <strong>{song.track_name || song.title}</strong>
              <div style={{ opacity: 0.65, fontSize: 13 }}>{song.artist_name || song.artist}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}