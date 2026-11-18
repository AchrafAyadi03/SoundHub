import { useEffect, useMemo, useRef } from 'react';
import { AudioLines, ListMusic, Star, StarHalf, X } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext.jsx';
import { formatArtists, formatDuration } from '../components.jsx';

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function uniqueQueue(queue, currentId) {
  const indexes = new Map();
  const unique = [];

  queue.forEach((song, index) => {
    const title = song.track_name || song.title || song.song_id || song.id || `titre ${index + 1}`;
    const firstArtist = String(song.artists || song.artist || '').split(';')[0];
    const key = `${normalize(title)}\u0000${normalize(firstArtist)}`;
    const existingIndex = indexes.get(key);
    if (existingIndex == null) {
      indexes.set(key, unique.length);
      unique.push(song);
    } else if ((song.song_id || song.id) === currentId) {
      unique[existingIndex] = song;
    }
  });

  return unique;
}

function PopularityBar({ value }) {
  if (value == null || value === '' || !Number.isFinite(Number(value))) return null;
  const score = Math.max(0, Math.min(100, Math.round(Number(value))));
  return (
    <span
      className="track-popularity"
      title={`Popularité : ${score}/100`}
      aria-label={`Popularité : ${score}/100`}
    >
      <i style={{ width: `${score}%` }} />
    </span>
  );
}

function Rating({ value }) {
  if (value == null || value === '' || !Number.isFinite(Number(value))) return null;
  const rating = Number(value);
  if (rating < 0 || rating > 5) return null;
  const rounded = Math.round(rating * 2) / 2;
  return (
    <span className="album-score" aria-label={`Note : ${rounded.toLocaleString('fr-FR')}/5`}>
      <strong>{rounded.toLocaleString('fr-FR')}/5</strong>
      <span aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => {
          const part = rounded - index;
          if (part >= 1) return <Star className="rating-star is-filled" size={15} key={index} />;
          if (part >= 0.5) return <StarHalf className="rating-star is-filled" size={15} key={index} />;
          return <Star className="rating-star" size={15} key={index} />;
        })}
      </span>
    </span>
  );
}

export default function QueuePanel({ onClose, mobileOpen = false }) {
  const player = usePlayer();
  const currentId = player.current?.song_id || player.current?.id;
  const songs = useMemo(() => uniqueQueue(player.queue, currentId), [player.queue, currentId]);
  const currentRowRef = useRef(null);
  const context = player.contextLabel || 'Catalogue';

  useEffect(() => {
    currentRowRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [currentId, songs, mobileOpen]);

  return (
    <aside
      className={`queue-panel album-track-panel ${mobileOpen ? 'queue-mobile-open' : ''}`}
      aria-label="À suivre"
    >
      <header>
        <div>
          <h3>À suivre</h3>
          <p>{context} · {songs.length} titre{songs.length === 1 ? '' : 's'}</p>
        </div>
        <div className="queue-heading-actions">
          <Rating value={player.current?.rating} />
          <button type="button" className="queue-close" onClick={onClose} aria-label="Fermer la file d’attente">
            <X size={18} />
          </button>
        </div>
      </header>
      <div className="queue-list album-track-list" role="list">
        {!songs.length ? (
          <div className="queue-empty"><ListMusic size={21} /><span>Aucun titre en attente</span></div>
        ) : songs.map((song, index) => {
          const songId = song.song_id || song.id;
          const isCurrent = songId === currentId;
          const title = song.track_name || song.title || 'Titre inconnu';
          const artists = formatArtists(song.artists || song.artist) || 'Artiste inconnu';

          return (
            <div className="queue-row-container" role="listitem" key={songId || `${title}-${index}`}>
              <button
                ref={isCurrent ? currentRowRef : null}
                type="button"
                className={`queue-item album-track-row ${isCurrent ? 'queue-current' : ''}`}
                onClick={() => player.playSong(song, player.queue)}
                aria-label={`Lire ${title} par ${artists}`}
                aria-current={isCurrent ? 'true' : undefined}
              >
                <span className="track-number">
                  {isCurrent ? (
                    <span className="track-equalizer" aria-hidden="true"><i /><i /><i /></span>
                  ) : String(index + 1).padStart(2, '0')}
                </span>
                <span className="queue-song">
                  <strong title={title}>{title}</strong>
                  <span title={artists}>{artists}</span>
                </span>
                <span className="track-duration">{formatDuration(song.duration_ms)}</span>
                {!isCurrent && <PopularityBar value={song.popularity} />}
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
