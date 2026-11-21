/* =====================================================================
 * src/pages/MyPlaylists.jsx : bibliothèque de playlists de l'utilisateur
 * ---------------------------------------------------------------------
 * Cas d'utilisation (page réservée aux connectés, via <ProtectedRoute>) :
 *   - créer une playlist ;
 *   - changer sa visibilité (privée / non listée / publique) ;
 *   - générer ou révoquer un lien de partage ;
 *   - supprimer une playlist.
 * ===================================================================== */
import { useEffect, useState } from 'react';
import { ExternalLink, ListMusic, Pause, Play, Trash2 } from 'lucide-react';
import { http as api } from '../api';
import { api as apiObject } from '../api';
import { EmptyState, SongCover, formatArtists, formatDuration } from '../components.jsx';
import { usePlayer } from '../context/PlayerContext';

const LABELS = { private: 'Privée', unlisted: 'Non listée (lien)', public: 'Publique' };

export default function MyPlaylists() {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [visibility, setVisibility] = useState('private');
  const [shareLinks, setShareLinks] = useState({}); // id -> lien affiché
  const [openId, setOpenId] = useState('');
  const [details, setDetails] = useState({});
  const [catalogue, setCatalogue] = useState([]);
  const player = usePlayer(); // id -> lien affiché

  // Charge les playlists de l'utilisateur au premier affichage.
  useEffect(() => {
    api('/playlists/mine')
      .then(setPlaylists)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    apiObject.songs('', 500).then((songs) => setCatalogue(Array.isArray(songs) ? songs : [])).catch(() => setCatalogue([]));
  }, []);

  // Remplace une playlist dans la liste après modification.
  const replace = (updated) =>
    setPlaylists((list) => list.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));

  /* Créer : bouton « Nouvelle playlist ». */
  async function create(e) {
    e.preventDefault();
    setError('');
    try {
      const pl = await api('/playlists', { method: 'POST', body: { title, visibility } });
      setPlaylists((list) => [pl, ...list]);
      setTitle('');
    } catch (err) { setError(err.message); }
  }

  /* Changer la visibilité. */
  async function changeVisibility(pl, value) {
    setError('');
    try {
      const updated = await api(`/playlists/${pl.id}`, { method: 'PUT', body: { visibility: value } });
      replace(updated);
    } catch (err) { setError(err.message); }
  }

  /* Partager : génère le lien (une playlist privée devient « non listée »). */
  async function share(pl) {
    setError('');
    try {
      const r = await api(`/playlists/${pl.id}/share`, { method: 'POST' });
      setShareLinks((links) => ({ ...links, [pl.id]: r.shareUrl }));
      replace({ id: pl.id, visibility: r.visibility, shareToken: r.shareToken });
      await navigator.clipboard?.writeText(r.shareUrl).catch(() => {});
    } catch (err) { setError(err.message); }
  }

  /* Arrêter le partage : l'ancien lien cesse de fonctionner. */
  async function unshare(pl) {
    setError('');
    try {
      const r = await api(`/playlists/${pl.id}/share`, { method: 'DELETE' });
      setShareLinks((links) => { const next = { ...links }; delete next[pl.id]; return next; });
      replace({ id: pl.id, visibility: r.visibility, shareToken: undefined });
    } catch (err) { setError(err.message); }
  }

  async function openPlaylist(pl) {
    if (openId === pl.id) {
      setOpenId('');
      return;
    }
    setError('');
    try {
      const detail = await api(`/playlists/${pl.id}`);
      setDetails((value) => ({ ...value, [pl.id]: detail }));
      setOpenId(pl.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeTrack(pl, trackId) {
    if (!window.confirm('Retirer ce morceau de la playlist ?')) return;
    setError('');
    try {
      const updated = await api(`/playlists/${pl.id}/tracks/${encodeURIComponent(trackId)}`, { method: 'DELETE' });
      replace(updated);
      setDetails((value) => ({ ...value, [pl.id]: updated }));
    } catch (err) {
      setError(err.message);
    }
  }

  /* Supprimer définitivement. */
  async function remove(pl) {
    if (!window.confirm(`Supprimer « ${pl.title} » ?`)) return;
    setError('');
    try {
      await api(`/playlists/${pl.id}`, { method: 'DELETE' });
      setPlaylists((list) => list.filter((p) => p.id !== pl.id));
    } catch (err) { setError(err.message); }
  }

  return (
    <main className="my-playlists">
      <h1>Mes playlists</h1>

      <form onSubmit={create} className="inline-form">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nom de la playlist" maxLength={150} required />
        <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
          {Object.entries(LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button type="submit">Nouvelle playlist</button>
      </form>

      {error && <p className="form-error" role="alert">{error}</p>}
      {loading && <p>Chargement…</p>}
      {!loading && playlists.length === 0 && <p>Vous n'avez pas encore de playlist.</p>}

      <ul>
        {playlists.map((pl) => {
          const detail = details[pl.id];
          const byId = new Map(catalogue.map((song) => [String(song.song_id || song.id), song]));
          const tracks = detail?.tracks
            ? [...detail.tracks]
              .sort((a, b) => a.position - b.position)
              .map((track) => track.song || byId.get(track.trackId))
              .filter(Boolean)
            : [];
          return (
            <li key={pl.id} className={openId === pl.id ? 'is-open' : ''}>
              <div className="my-playlist-summary">
                <button type="button" className="my-playlist-open" onClick={() => openPlaylist(pl)} aria-expanded={openId === pl.id}>
                  <span className="my-playlist-icon"><ListMusic size={18} /></span>
                  <span><strong>{pl.title}</strong><small>{pl.tracksCount} morceau{pl.tracksCount > 1 ? 'x' : ''}</small></span>
                </button>
                <select value={pl.visibility} onChange={(e) => changeVisibility(pl, e.target.value)} aria-label={`Visibilité de ${pl.title}`}>
                  {Object.entries(LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <button onClick={() => share(pl)}>{pl.shareToken ? 'Copier le lien' : 'Partager'}</button>
                {pl.shareToken && <button onClick={() => unshare(pl)}>Arrêter le partage</button>}
                {pl.shareToken && (
                  <a className="my-playlist-view" href={shareLinks[pl.id] || `/playlist/shared/${pl.shareToken}`} target={shareLinks[pl.id] ? undefined : '_self'}>
                    <ExternalLink size={15} /> Voir
                  </a>
                )}
                <button onClick={() => remove(pl)}>Supprimer</button>
              </div>
              {shareLinks[pl.id] && <p className="share-link-row">Lien : <code>{shareLinks[pl.id]}</code></p>}

              {openId === pl.id && (
                tracks.length ? (
                  <div className="my-playlist-tracks">
                    {tracks.map((song, index) => {
                      const songId = String(song.song_id || song.id);
                      const active = String(player.current?.song_id || player.current?.id) === songId;
                      return (
                        <article className={`playlist-track-row ${active ? 'is-active' : ''}`} key={songId}>
                          <span className="playlist-track-number">{String(index + 1).padStart(2, '0')}</span>
                          <SongCover song={song} size="sm" />
                          <button
                            type="button"
                            className="playlist-track-play"
                            onClick={() => active && player.playing ? player.togglePlay() : player.playSong(song, tracks)}
                            aria-label={`${active && player.playing ? 'Mettre en pause' : 'Lire'} ${song.track_name || song.title}`}
                          >
                            {active && player.playing ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
                          </button>
                          <div className="playlist-track-copy">
                            <strong>{song.track_name || song.title}</strong>
                            <span>{formatArtists(song.artists || song.artist)}</span>
                          </div>
                          <span className="playlist-track-album">{song.album_name || song.album || '—'}</span>
                          <span className="playlist-track-duration">{formatDuration(song.duration_ms)}</span>
                          <button type="button" className="playlist-track-remove" onClick={() => removeTrack(pl, songId)} aria-label={`Retirer ${song.track_name || song.title}`}>
                            <Trash2 size={16} />
                          </button>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState title="Playlist vide" description="Ajoutez des morceaux depuis le catalogue." />
                )
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}