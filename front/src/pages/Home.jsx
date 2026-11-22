import { memo, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Heart, ListPlus, TrendingUp } from 'lucide-react';
import { api } from '../api.js';
import { useFetch } from '../hooks.js';
import { EmptyState, ErrorState, LoadingState, getRows } from '../components.jsx';
import HeroBanner from '../components/HeroBanner.jsx';
import MusicCard from '../components/MusicCard.jsx';

const TrendCard = memo(function TrendCard({ song, index, onEvent, queue, featured, liked, onLike }) {
  const title = song.track_name || song.song_id || 'Titre inconnu';
  return (
    <MusicCard
      song={song}
      badge={String(index + 1).padStart(2, '0')}
      featured={featured}
      onPlay={() => onEvent(song, 'play', queue)}
      playLabel={`Écouter ${title}`}
      actions={(
        <>
          <button
            type="button"
            onClick={() => onLike?.(song)}
            aria-label={`${liked ? 'Retirer' : 'Ajouter'} ${title} ${liked ? 'des titres likés' : 'aux titres likés'}`}
            aria-pressed={liked}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 transition-all duration-200 ease-in-out active:scale-95 ${liked ? 'text-emerald-300 border-emerald-300/30 bg-emerald-300/10' : 'text-gray-300 hover:bg-emerald-300/10 hover:border-emerald-300/30 hover:text-emerald-300'}`}
          >
            <Heart size={16} fill={liked ? 'currentColor' : 'none'} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onEvent(song, 'playlist')}
            aria-label={`Ajouter ${title} à une playlist`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-gray-300 transition-all duration-200 ease-in-out hover:bg-emerald-300/10 hover:border-emerald-300/30 hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/50 active:scale-95"
          >
            <ListPlus size={16} aria-hidden="true" />
          </button>
        </>
      )}
    />
  );
});

export default function HomePage({ userId, onEvent, onNavigate }) {
  const top = useFetch(() => api.topSongs(10), []);
  const discovery = useFetch(() => api.songs('', 10), []);
  const inspired = useFetch(() => api.publicPlaylists({ page: 1, limit: 8 }), []);
  const topSongs = getRows(top.data);
  const newSongs = getRows(discovery.data);
  const inspiredPlaylists = Array.isArray(inspired.data?.items) ? inspired.data.items : [];
  const [likedIds, setLikedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('soundhub-liked-songs') || '[]');
    } catch {
      return [];
    }
  });
  useEffect(() => {
    localStorage.setItem('soundhub-liked-songs', JSON.stringify(likedIds));
  }, [likedIds]);
  const toggleLiked = (song) => {
    const id = String(song.song_id || song.id);
    setLikedIds((ids) => ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]);
  };

  const heroSongs = useMemo(() => (
    topSongs.length
      ? topSongs.slice(0, 5).map((song) => {
        const catalogSong = newSongs.find((item) => item.song_id === song.song_id);
        return {
          ...catalogSong,
          ...song,
          track_name: song.track_name || catalogSong?.track_name,
          artists: song.artists || catalogSong?.artists,
        };
      })
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
      <section className="spotify-home-header" aria-label="Accueil SoundHub">
        <div className="spotify-home-title">
          <span className="eyebrow">SoundHub</span>
          <h1>Bonjour</h1>
        </div>
        <div className="spotify-filter-pills" aria-label="Filtres rapides">
          <button type="button" className="is-selected" onClick={() => onNavigate('home')}>Tout</button>
          <button type="button" onClick={() => onNavigate('catalogue')}>Musique</button>
          <button type="button" onClick={() => onNavigate('playlists')}>Playlists</button>
        </div>
      </section>
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
          <div>
            <span className="eyebrow font-mono tracking-[0.2em] text-emerald-300/80">FAIT POUR VOUS</span>
            <h2 className="mt-2 text-2xl md:text-3xl font-bold tracking-tight">Playlists inspirées</h2>
            <p className="mt-1 text-gray-400">Sélections communautaires adaptées à vos envies.</p>
          </div>
          <button type="button" className="spotify-text-link" onClick={() => onNavigate('playlists')}>Tout afficher</button>
        </div>
        {inspired.loading ? <LoadingState rows={2} /> : inspired.error ? null : inspiredPlaylists.length ? (
          <div className="spotify-playlist-grid">
            {inspiredPlaylists.slice(0, 8).map((playlist) => (
              <button
                type="button"
                className="spotify-playlist-card"
                key={playlist.id}
                onClick={() => window.location.assign(playlist.shareToken ? `/playlist/shared/${playlist.shareToken}` : `/playlist/${playlist.id}`)}
              >
                <span className="spotify-playlist-cover"><ListPlus size={30} /></span>
                <strong>{playlist.title}</strong>
                <span>{playlist.description || `Créée par ${playlist.owner?.username || 'la communauté'} · ${playlist.tracksCount} titres`}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="spotify-empty-playlists">
            <ListPlus size={22} />
            <div><strong>Créez votre première playlist</strong><span>Ajoutez vos titres préférés et retrouvez-les ici.</span></div>
          </div>
        )}
      </section>

      <section className="content-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow font-mono tracking-[0.2em] text-emerald-300/80">TENDANCES</span>
            <h2 className="mt-2 text-2xl md:text-3xl font-bold tracking-tight">
              <span className="text-gradient">Les plus écoutées</span>
            </h2>
            <p className="mt-1 text-gray-400">Les titres qui rythment la communauté.</p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-gray-300 transition-all duration-200 ease-in-out hover:bg-emerald-300/10 hover:text-emerald-300 active:scale-95"
            onClick={() => onNavigate('stats')}
          >
            Voir les statistiques <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
        {top.loading ? <LoadingState rows={2} /> : top.error ? <ErrorState message={top.error} onRetry={top.retry} /> : topSongs.length ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {topSongs.slice(0, 10).map((song, index) => (
              <TrendCard
                key={song.song_id || index}
                song={song}
                index={index}
                queue={topSongs}
                onEvent={onEvent}
                featured={index === 0}
                liked={likedIds.includes(String(song.song_id || song.id))}
                onLike={toggleLiked}
              />
            ))}
          </div>
        ) : <EmptyState title="Pas encore de tendances" description="Les titres les plus écoutés apparaîtront ici." />}
      </section>

      <section className="content-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow font-mono tracking-[0.2em] text-emerald-300/80">SÉLECTION</span>
            <h2 className="mt-2 text-2xl md:text-3xl font-bold tracking-tight">
              <span className="text-gradient">À découvrir</span>
            </h2>
            <p className="mt-1 text-gray-400">Une sélection du catalogue pour votre prochaine écoute.</p>
          </div>
          <span className="title-icon">
            <TrendingUp size={19} aria-hidden="true" />
          </span>
        </div>
        {discovery.loading ? <LoadingState rows={2} /> : discovery.error ? <ErrorState message={discovery.error} onRetry={discovery.retry} /> : newSongs.length ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {newSongs.slice(0, 10).map((song, index) => (
              <TrendCard
                key={song.song_id || index}
                song={song}
                index={index}
                queue={newSongs}
                onEvent={onEvent}
                featured={index === 0}
                liked={likedIds.includes(String(song.song_id || song.id))}
                onLike={toggleLiked}
              />
            ))}
          </div>
        ) : <EmptyState title="Catalogue vide" description="Aucun titre n’est disponible pour le moment." />}
      </section>
    </div>
  );
}