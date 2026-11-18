import { memo, useMemo } from 'react';
import { ArrowRight, Play, TrendingUp } from 'lucide-react';
import { api } from '../api.js';
import { useFetch } from '../hooks.js';
import { Button, Card, EmptyState, ErrorState, LoadingState, SongCover, getRows } from '../components.jsx';
import HeroBanner from '../components/HeroBanner.jsx';

const SongCard = memo(function SongCard({ song, index, onEvent, queue }) {
  return (
    <Card className="song-card">
      <div className="song-art">
        <SongCover song={song} size="large" />
        <button className="art-play" aria-label={`Écouter ${song.track_name || 'ce titre'}`} onClick={() => onEvent(song, 'play', queue)}><Play size={18} fill="currentColor" /></button>
      </div>
      <div className="song-card-meta">
        <span className="song-rank">{String(index + 1).padStart(2, '0')}</span>
        <strong title={song.track_name}>{song.track_name || song.song_id}</strong>
        <span>{song.artists || 'Artiste inconnu'}</span>
      </div>
      <button className="song-card-add" aria-label={`Ajouter ${song.track_name || 'ce titre'}`} onClick={() => onEvent(song, 'add')}>+</button>
    </Card>
  );
});

export default function HomePage({ userId, onEvent, onNavigate }) {
  const top = useFetch(() => api.topSongs(10), []);
  const discovery = useFetch(() => api.songs('', 10), []);
  const topSongs = getRows(top.data);
  const newSongs = getRows(discovery.data);
  const heroSongs = useMemo(() => (
    topSongs.length
      ? topSongs.slice(0, 5).map((song) => ({
        ...(newSongs.find((item) => item.song_id === song.song_id) || {}),
        ...song,
      }))
      : newSongs.slice(0, 1)
  ), [topSongs, newSongs]);
  const heroLoading = top.loading || (!topSongs.length && discovery.loading);
  const heroError = top.error && !topSongs.length
    ? top.error
    : discovery.error && !topSongs.length
      ? discovery.error
      : null;
  const retryHero = () => {
    top.retry();
    discovery.retry();
  };

  return (
    <div className="page-stack">
      <HeroBanner
        slides={heroSongs}
        queue={topSongs.length ? heroSongs : newSongs}
        onEvent={onEvent}
        loading={heroLoading}
        error={heroError}
        onRetry={retryHero}
      />
      {top.error && topSongs.length === 0 && newSongs.length > 0 && (
        <p className="sr-only" role="status">Le classement est indisponible. Le catalogue est affiché en remplacement.</p>
      )}

      <section className="content-section">
        <div className="section-heading">
          <div><span className="eyebrow">TENDANCES</span><h2>Les plus écoutées</h2><p>Les titres qui rythment la communauté.</p></div>
          <Button className="button-quiet" onClick={() => onNavigate('stats')}>Voir les statistiques <ArrowRight size={15} /></Button>
        </div>
        {top.loading ? <LoadingState rows={2} /> : top.error ? <ErrorState message={top.error} onRetry={top.retry} /> : topSongs.length ? (
          <div className="song-grid">
            {topSongs.slice(0, 10).map((song, index) => <SongCard key={song.song_id || index} song={song} index={index} queue={topSongs} onEvent={onEvent} />)}
          </div>
        ) : <EmptyState title="Pas encore de tendances" description="Les titres les plus écoutés apparaîtront ici." />}
      </section>

      <section className="content-section">
        <div className="section-heading">
          <div><span className="eyebrow">SÉLECTION</span><h2>À découvrir</h2><p>Une sélection du catalogue pour votre prochaine écoute.</p></div>
          <span className="section-icon"><TrendingUp size={19} /></span>
        </div>
        {discovery.loading ? <LoadingState rows={2} /> : discovery.error ? <ErrorState message={discovery.error} onRetry={discovery.retry} /> : newSongs.length ? (
          <div className="song-grid">
            {newSongs.slice(0, 10).map((song, index) => <SongCard key={song.song_id || index} song={song} index={index} queue={newSongs} onEvent={onEvent} />)}
          </div>
        ) : <EmptyState title="Catalogue vide" description="Aucun titre n’est disponible pour le moment." />}
      </section>
    </div>
  );
}
