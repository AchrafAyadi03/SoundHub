import { useMemo, useState } from 'react';
import { Disc3, ListMusic, Play, Plus, SkipForward } from 'lucide-react';
import { api } from '../api.js';
import { useFetch, useDebounced } from '../hooks.js';
import { Button, EmptyState, ErrorState, LoadingState, SongCover, Table, formatDuration, getRows } from '../components.jsx';

export default function Catalogue({ query, onQueryChange, onEvent }) {
  const [genre, setGenre] = useState('');
  const [limit, setLimit] = useState(30);
  const debouncedQuery = useDebounced(query, 300);
  const request = useFetch(() => api.songs(debouncedQuery, limit), [debouncedQuery, limit]);
  const songs = getRows(request.data);
  const genres = useMemo(() => [...new Set(songs.map((song) => song.track_genre).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [songs]);
  const filtered = genre ? songs.filter((song) => song.track_genre === genre) : songs;

  return (
    <div className="page-stack">
      <div className="page-title-row">
        <div><span className="eyebrow">BIBLIOTHÈQUE</span><h1>Catalogue</h1><p>Parcourez les titres et enregistrez vos interactions.</p></div>
        <span className="title-icon"><Disc3 size={22} /></span>
      </div>
      <section className="filter-bar" aria-label="Filtres du catalogue">
        <label className="filter-search"><span>Recherche</span><input value={query} onChange={(event) => { onQueryChange(event.target.value); setLimit(30); }} placeholder="Titre ou artiste…" /></label>
        <label><span>Genre</span><select value={genre} onChange={(event) => setGenre(event.target.value)}><option value="">Tous les genres</option>{genres.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <span className="result-count">{songs.length ? `${filtered.length} titre${filtered.length > 1 ? 's' : ''}` : ''}</span>
      </section>
      {request.loading ? <LoadingState rows={6} /> : request.error ? <ErrorState message={request.error} onRetry={request.retry} /> : !filtered.length ? <EmptyState title={query || genre ? 'Aucun titre correspondant' : 'Catalogue vide'} description="Essayez une autre recherche ou un autre genre." /> : (
        <>
          <Table>
            <thead><tr><th className="number-col">N°</th><th>Titre et artiste</th><th className="album-col">Album</th><th>Genre</th><th>Durée</th><th className="actions-col">Actions</th></tr></thead>
            <tbody>{filtered.map((song, index) => (
              <tr key={song.song_id}>
                <td className="row-number">{String(index + 1).padStart(2, '0')}</td>
                <td><div className="table-song"><SongCover song={song} size="small" /><span className="song-cell"><strong>{song.track_name || song.song_id}</strong><span>{song.artists || 'Artiste inconnu'}</span></span></div></td>
                <td className="muted album-col">{song.album_name || '—'}</td>
                <td><span className="genre-label">{song.track_genre || '—'}</span></td>
                <td className="muted">{formatDuration(song.duration_ms)}</td>
                <td><div className="row-actions">
                  <Button className="icon-button" aria-label={`Écouter ${song.track_name}`} onClick={() => onEvent(song, 'play')}><Play size={16} /></Button>
                  <Button className="icon-button" aria-label={`Passer ${song.track_name}`} onClick={() => onEvent(song, 'skip')}><SkipForward size={16} /></Button>
                  <Button className="icon-button" aria-label={`Ajouter ${song.track_name}`} onClick={() => onEvent(song, 'add')}><Plus size={17} /></Button>
                </div></td>
              </tr>
            ))}</tbody>
          </Table>
          {songs.length >= limit && <div className="load-more"><Button className="button-secondary" onClick={() => setLimit((value) => value + 30)}><ListMusic size={16} /> Charger plus</Button></div>}
        </>
      )}
    </div>
  );
}
