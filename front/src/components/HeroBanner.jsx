import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Play, Plus } from 'lucide-react';
import { SongCover, formatArtists } from '../components.jsx';

const AUTOPLAY_MS = 7000;

export default function HeroBanner({ slides = [], queue = [], onEvent, loading = false, error = null, onRetry }) {
  const [index, setIndex] = useState(0);
  const [outgoing, setOutgoing] = useState(null);
  const touchX = useRef(null);
  const slidesSafe = slides.filter(Boolean);
  const total = slidesSafe.length;
  const current = slidesSafe[index % Math.max(total, 1)];

  useEffect(() => {
    if (index >= total) setIndex(0);
  }, [total, index]);

  const goTo = useCallback((nextIndex) => {
    if (total < 2) return;
    setOutgoing(slidesSafe[index]);
    setIndex(((nextIndex % total) + total) % total);
    window.setTimeout(() => setOutgoing(null), 550);
  }, [index, slidesSafe, total]);

  useEffect(() => {
    if (total < 2) return undefined;
    const id = window.setTimeout(() => goTo(index + 1), AUTOPLAY_MS);
    return () => window.clearTimeout(id);
  }, [goTo, index, total]);

  const accent = useMemo(() => {
    if (!current) return '#1a201b';
    const seed = current.song_id || current.track_name || 'soundhub';
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 360;
    return `hsl(${hash} 32% 22%)`;
  }, [current]);

  const handleTouchStart = (e) => { touchX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchX.current == null) return;
    const delta = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(delta) > 50) goTo(index + (delta < 0 ? 1 : -1));
    touchX.current = null;
  };

  if (loading) {
    return (
      <div className="hero-banner hero-banner-skeleton">
        <div className="hero-skeleton hero-skeleton-initial" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="hero-banner hero-banner-state">
        <div className="hero-state-copy">
          <span className="hero-kicker font-mono">UNE ERREUR EST SURVENUE</span>
          <h1>Impossible de charger la sélection</h1>
          <p>{typeof error === 'string' ? error : 'Vérifiez votre connexion.'}</p>
          {onRetry && (
            <button type="button" className="btn-neon inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-bold" onClick={onRetry}>
              Réessayer
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!current) return null;

  const title = current.track_name || current.song_id || 'Titre inconnu';
  const artists = formatArtists(current.artists || current.artist) || 'Artiste inconnu';
  const genre = current.track_genre || current.mood;

  return (
    <div
      className="hero-banner"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      aria-roledescription="carrousel"
      aria-label="Sélection mise en avant"
    >
      {/* Slide entrante */}
      <div
        className="hero-slide"
        style={{ '--hero-fallback': accent }}
        key={`in-${current.song_id || index}`}
      >
        <SongCover song={current} fill className="hero-blur-image" aria-hidden="true" />
        <div className="hero-scrim" />

        <div className="relative z-[2] flex h-full items-center gap-8 px-8 md:px-14">
          {/* COLONNE GAUCHE */}
          <div className="flex-1 max-w-[620px]">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300 backdrop-blur-md font-mono">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
              </span>
              Artiste du moment
            </span>

            <h1 className="mt-5 text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight">
              <span className="text-gradient">{title}</span>
            </h1>

            <p className="mt-3 text-base md:text-lg text-gray-300">{artists}</p>

            {genre && (
              <span className="mt-4 inline-flex rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-gray-200 backdrop-blur">
                {genre}
              </span>
            )}

            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onEvent(current, 'play', queue)}
                className="btn-neon inline-flex h-12 items-center gap-2 rounded-full px-6 text-sm font-bold active:scale-95"
              >
                <Play size={16} fill="currentColor" /> Écouter
              </button>
              <button
                type="button"
                onClick={() => onEvent(current, 'add')}
                className="group/add inline-flex h-12 items-center gap-2 rounded-full border border-white/25 bg-white/5 px-6 text-sm font-semibold text-white backdrop-blur-md transition-all hover:border-white/60 hover:bg-white/10 active:scale-95"
              >
                <Plus size={16} className="transition-transform duration-300 group-hover/add:rotate-90" />
                Ajouter
              </button>
            </div>
          </div>

          {/* COLONNE DROITE — Pochette 3D flottante */}
          <div className="relative hidden md:flex flex-shrink-0 w-[220px] lg:w-[280px] aspect-square items-center justify-center">
            <div
              className="absolute inset-[-20%] rounded-full blur-[80px] opacity-40 pointer-events-none"
              style={{ background: 'var(--color-accent)' }}
            />
            <div
              className="relative w-full h-full rounded-2xl overflow-hidden border border-white/25 shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
              style={{ animation: 'float 6s ease-in-out infinite' }}
            >
              <SongCover song={current} fill className="!rounded-2xl" />
            </div>
          </div>
        </div>
      </div>

      {/* Slide sortante (fade out) */}
      {outgoing && (
        <div
          className="hero-slide hero-slide-outgoing"
          style={{ '--hero-fallback': accent }}
          key={`out-${outgoing.song_id || index}`}
        >
          <SongCover song={outgoing} fill className="hero-blur-image" aria-hidden="true" />
          <div className="hero-scrim" />
        </div>
      )}

      {/* Contrôles */}
      <div className="hero-controls">
        <button
          type="button"
          className="hero-arrow"
          aria-label="Slide précédente"
          onClick={() => goTo(index - 1)}
          disabled={total < 2}
        >
          <ArrowLeft size={15} />
        </button>
        <div className="hero-indicators" role="tablist">
          {slidesSafe.map((slide, i) => (
            <button
              key={slide.song_id || i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Slide ${i + 1}`}
              className={`hero-indicator ${i === index ? 'is-active' : ''}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
        <button
          type="button"
          className="hero-arrow"
          aria-label="Slide suivante"
          onClick={() => goTo(index + 1)}
          disabled={total < 2}
        >
          <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}