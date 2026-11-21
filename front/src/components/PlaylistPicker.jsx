import { useEffect, useState } from 'react';
import { ListMusic, Plus, X } from 'lucide-react';
import { http } from '../api';
import { useAuth } from '../context/AuthContext';

export default function PlaylistPicker({ song, onClose, onAdded }) {
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [addingId, setAddingId] = useState('');

  useEffect(() => {
    if (!user) return;
    http('/playlists/mine')
      .then(setPlaylists)
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [user]);

  const createAndAdd = async (event) => {
    event.preventDefault();
    if (!title.trim()) return;
    setError('');
    setAddingId('create');
    try {
      const playlist = await http('/playlists', {
        method: 'POST',
        body: { title: title.trim(), visibility: 'private' },
      });
      await http(`/playlists/${playlist.id}/tracks`, {
        method: 'POST',
        body: { trackId: song.song_id || song.id },
      });
      onAdded?.(song, playlist.title);
      onClose();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setAddingId('');
    }
  };

  const addToPlaylist = async (playlist) => {
    setError('');
    setAddingId(playlist.id);
    try {
      await http(`/playlists/${playlist.id}/tracks`, {
        method: 'POST',
        body: { trackId: song.song_id || song.id },
      });
      onAdded?.(song, playlist.title);
      onClose();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setAddingId('');
    }
  };

  if (!user) return null;

  return (
    <div className="playlist-picker-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="playlist-picker" role="dialog" aria-modal="true" aria-labelledby="playlist-picker-title">
        <header>
          <div>
            <span className="playlist-picker-kicker">Ajouter à une playlist</span>
            <h2 id="playlist-picker-title">{song.track_name || song.title || 'Titre inconnu'}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </header>

        {error && <p className="form-error" role="alert">{error}</p>}

        {loading ? (
          <p className="playlist-picker-loading">Chargement des playlists…</p>
        ) : (
          <div className="playlist-picker-list">
            {playlists.map((playlist) => (
              <button
                type="button"
                key={playlist.id}
                onClick={() => addToPlaylist(playlist)}
                disabled={addingId === playlist.id}
              >
                <span className="playlist-picker-icon"><ListMusic size={18} /></span>
                <span>
                  <strong>{playlist.title}</strong>
                  <small>{playlist.tracksCount} morceau{playlist.tracksCount > 1 ? 'x' : ''}</small>
                </span>
                <Plus size={17} />
              </button>
            ))}
          </div>
        )}

        <form className="playlist-picker-create" onSubmit={createAndAdd}>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Nom de la nouvelle playlist"
            maxLength={150}
            aria-label="Nom de la nouvelle playlist"
          />
          <button type="submit" disabled={!title.trim() || addingId === 'create'}>
            <Plus size={16} /> Créer
          </button>
        </form>
      </section>
    </div>
  );
}
