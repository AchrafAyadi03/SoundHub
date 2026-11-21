import { memo, useMemo, useState } from 'react';
import { Disc3, ListMusic, ListPlus, SkipForward } from 'lucide-react';
import { api } from '../api.js';
import { useFetch, useDebounced } from '../hooks.js';
import { EmptyState, ErrorState, LoadingState, formatDuration, getRows } from '../components.jsx';
import MusicCard from '../components/MusicCard.jsx';

const CatalogueCard = memo(function CatalogueCard({ song, queue, onEvent, featured }) {
  const title = song.track_name || song.song_id || 'Titre inconnu';
  const actionClass =
    'inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-gray-300 transition-all duration-200 ease-in-out hover:bg-emerald-300/10 hover:border-emerald-300/30 hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/50 active:scale-95';

  return (
    <MusicCard
      song={song}
      featured={featured}
      onPlay={() => onEvent(song, 'play', queue)}
      playLabel={`Écouter ${title}`}
      meta={(
        <>
          <span className="truncate">{song.track_genre || song.mood || '—'}</span>
          <span aria-hidden="true">•</span>
          <span>{formatDuration(song.duration_ms)}</span>
        </>
      )}
      actions={(
        <>
          <button type="button" className={actionClass} aria-label={`Passer ${title}`} onClick={() => onEvent(song, 'skip')}>
            <SkipForward size={16} aria-hidden="true" />
          </button>
          <button type="button" className={actionClass} aria-label={`Ajouter ${title} à une playlist`} onClick={() => onEvent(song, 'playlist')}>
            <ListPlus size={17} aria-hidden="true" />
          </button>
        </>
      )}
    />
  );
});

export default function Catalogue({ query, onQueryChange, onEvent }) {
  const [genre, setGenre] = useState('');
  const [limit, setLimit] = useState(30);
  const debouncedQuery = useDebounced(query, 300);
  const request = useFetch(() => api.songs(debouncedQuery, limit), [debouncedQuery, limit]);
  const songs = getRows(request.data);

  const genres = useMemo(
    () => [...new Set(songs.map((song) => song.track_genre || song.mood).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [songs],
  );
  const filtered = genre ? songs.filter((song) => (song.track_genre || song.mood) === genre) : songs;

  return (
    <div className="page-stack">
      <div className="page-title-row">
        <div>
          <span className="eyebrow font-mono tracking-[0.2em] text-emerald-300/80">BIBLIOTHÈQUE</span>
          <h1 className="mt-2 text-4xl md:text-5xl font-bold tracking-tight">
            <span className="text-gradient">Catalogue</span>
          </h1>
          <p className="mt-2 text-gray-400">Parcourez les titres et enregistrez vos interactions.</p>
        </div>
        <span className="title-icon">
          <Disc3 size={22} aria-hidden="true" />
        </span>
      </div>

      <section className="flex flex-wrap items-center gap-4" aria-label="Filtres du catalogue">
        <label className="flex min-w-[220px] flex-1 items-center gap-3">
          <span className="sr-only">Recherche</span>
          <input
            className="h-12 w-full rounded-full border border-white/10 bg-white/5 px-5 text-sm text-white placeholder:text-gray-500 transition-all duration-300 focus:border-emerald-300/50 focus:outline-none focus:ring-2 focus:ring-emerald-300/20 focus:shadow-[0_0_24px_-4px_var(--accent-glow)]"
            value={query}
            onChange={(event) => { onQueryChange(event.target.value); setLimit(30); }}
            placeholder="Titre ou artiste…"
            aria-label="Recherche dans le catalogue"
          />
        </label>

        <label className="flex items-center gap-3">
          <span className="sr-only">Genre / humeur</span>
          <select
            className="h-12 min-w-[220px] rounded-full border border-white/10 bg-[#181D1A] px-5 text-sm text-white transition-all duration-300 focus:border-emerald-300/50 focus:outline-none focus:ring-2 focus:ring-emerald-300/20"
            value={genre}
            onChange={(event) => setGenre(event.target.value)}
            aria-label="Filtrer par genre ou humeur"
          >
            <option value="" className="bg-[#181D1A] text-white">Toutes les catégories</option>
            {genres.map((value) => (
              <option key={value} value={value} className="bg-[#181D1A] text-white">{value}</option>
            ))}
          </select>
        </label>

        <span className="text-sm text-gray-500 font-mono">
          {songs.length ? `${filtered.length} titre${filtered.length > 1 ? 's' : ''}` : ''}
        </span>
      </section>

      {request.loading ? <LoadingState rows={6} /> : request.error ? <ErrorState message={request.error} onRetry={request.retry} /> : !filtered.length ? (
        <EmptyState
          title={query || genre ? 'Aucun titre correspondant' : 'Catalogue vide'}
          description="Essayez une autre recherche ou un autre genre."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" aria-label="Résultats du catalogue">
            {filtered.map((song, i) => (
              <CatalogueCard
                key={song.song_id}
                song={song}
                queue={filtered}
                onEvent={onEvent}
                featured={i === 0}
              />
            ))}
          </div>
          {songs.length >= limit && (
            <div className="flex justify-center pt-4">
              <button
                type="button"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[#181D1A] border border-white/10 px-6 text-sm font-medium text-white transition-all duration-200 ease-in-out hover:bg-[#1E2420] hover:border-emerald-300/30 hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/50 active:scale-95"
                onClick={() => setLimit((value) => value + 30)}
              >
                <ListMusic size={16} aria-hidden="true" /> Charger plus
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}