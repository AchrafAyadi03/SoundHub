import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ListMusic, Pause, Play, Trash2 } from 'lucide-react';
import { api, http } from '../api';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';
import { Avatar, EmptyState, ErrorState, LoadingState, SongCover, formatArtists, formatDuration } from '../components.jsx';

export default function SharedPlaylist() {
  const { token, id } = useParams();
  const { user } = useAuth();
  const player = usePlayer();
  const [playlist, setPlaylist] = useState(null);
  const [catalogue, setCatalogue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [shared, songs] = await Promise.all([
        token ? api.sharedPlaylist(token) : api.playlist(id),
        api.songs('', 500),
      ]);
      setPlaylist(shared);
      setCatalogue(Array.isArray(songs) ? songs : []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token, id]);

  const songs = useMemo(() => {
    if (!playlist?.tracks) return [];
    const byId = new Map(catalogue.map((song) => [String(song.song_id || song.id), song]));
    return playlist.tracks
      .sort((a, b) => a.position - b.position)
      .map((track) => track.song || byId.get(track.trackId))
      .filter(Boolean);
  }, [playlist, catalogue]);

  const removeTrack = async (trackId) => {
    if (!window.confirm('Retirer ce morceau de la playlist ?')) return;
    try {
      const updated = await http(`/playlists/${playlist.id}/tracks/${encodeURIComponent(trackId)}`, { method: 'DELETE' });
      setPlaylist(updated);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  if (loading) return <main className="shared-playlist"><LoadingState rows={5} /></main>;
  if (error) return <main className="shared-playlist"><ErrorState message={error} onRetry={load} /></main>;
  if (!playlist) return null;

  const isOwner = user?.id && playlist.owner?.id === user.id;

  return (
    <main className="shared-playlist">
      <header className="shared-playlist-header">
        <span className="shared-playlist-icon"><ListMusic size={28} /></span>
        <div>
          <span className="eyebrow">Playlist partagée</span>
          <h1>{playlist.title}</h1>
          {playlist.description && <p>{playlist.description}</p>}
          {playlist.owner?.username && (
            <div className="shared-playlist-owner">
              <Avatar name={playlist.owner.username} />
              <span>Créée par {playlist.owner.username}</span>
            </div>
          )}
        </div>
      </header>

      {!songs.length ? (
        <EmptyState title="Aucun morceau disponible" description="Cette playlist ne contient aucun titre du catalogue actuel." />
      ) : (
        <section className="playlist-track-list" aria-label={`Morceaux de ${playlist.title}`}>
          {songs.map((song, index) => {
            const songId = String(song.song_id || song.id);
            const active = String(player.current?.song_id || player.current?.id) === songId;
            return (
              <article className={`playlist-track-row ${active ? 'is-active' : ''}`} key={songId}>
                <span className="playlist-track-number">{String(index + 1).padStart(2, '0')}</span>
                <SongCover song={song} size="sm" />
                <button
                  type="button"
                  className="playlist-track-play"
                  onClick={() => active && player.playing ? player.togglePlay() : player.playSong(song, songs)}
                  aria-label={`${active && player.playing ? 'Mettre en pause' : 'Lire'} ${song.track_name || song.title}`}
                >
                  {active && player.playing ? <Pause size={17} /> : <Play size={17} fill="currentColor" />}
                </button>
                <div className="playlist-track-copy">
                  <strong>{song.track_name || song.title}</strong>
                  <span>{formatArtists(song.artists || song.artist)}</span>
                </div>
                <span className="playlist-track-album">{song.album_name || song.album || '—'}</span>
                <span className="playlist-track-duration">{formatDuration(song.duration_ms)}</span>
                {isOwner && (
                  <button type="button" className="playlist-track-remove" onClick={() => removeTrack(songId)} aria-label={`Retirer ${song.track_name || song.title}`}>
                    <Trash2 size={16} />
                  </button>
                )}
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
