import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Play, Plus } from 'lucide-react';
import { Button, formatArtists } from '../components.jsx';
import { hashColor } from '../hooks/useCoverColor.js';
import useHeroImages from '../hooks/useHeroImages.js';

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => (
    typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ));

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  return reduced;
}

export function useCarousel(count, reducedMotion) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setIndex((current) => count ? current % count : 0);
  }, [count]);

  useEffect(() => {
    if (count < 2 || paused || reducedMotion) return undefined;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % count);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [count, paused, reducedMotion]);

  const goTo = (target) => {
    if (!count) return;
    setIndex((target + count) % count);
  };

  return {
    index: count ? index % count : 0,
    goTo,
    next: () => goTo(index + 1),
    previous: () => goTo(index - 1),
    pause: () => setPaused(true),
    resume: () => setPaused(false),
  };
}

function HeroSlide({ song, imageData, onEvent, queue, inactive = false }) {
  const [failedArtist, setFailedArtist] = useState(false);
  const [failedCover, setFailedCover] = useState(false);
  const [smallImage, setSmallImage] = useState(false);
  const id = String(song.song_id || song.id || 'soundhub');
  const artistImage = imageData?.artistImage;
  const cover = imageData?.media?.cover_url;
  const imageUrl = !failedArtist && artistImage
    ? artistImage
    : !failedCover && cover
      ? cover
      : null;
  const hasArtistImage = Boolean(artistImage && !failedArtist && imageUrl === artistImage);
  const label = hasArtistImage ? 'Artiste du moment' : 'Titre du moment';

  const handleImageError = () => {
    if (imageUrl === artistImage) setFailedArtist(true);
    else setFailedCover(true);
    setSmallImage(false);
  };

  return (
    <article
      key={id}
      className={`hero-slide ${imageData?.loading ? 'hero-slide-loading' : ''}`}
      style={{ '--hero-fallback': hashColor(id) }}
      aria-hidden={inactive || undefined}
      aria-label={`${song.track_name || 'Titre du moment'} par ${formatArtists(song.artists) || 'artiste inconnu'}`}
    >
      {imageUrl && (
        <>
          {smallImage && <img className="hero-blur-image" src={imageUrl} alt="" aria-hidden="true" />}
          <img
            className="hero-background-image"
            src={imageUrl}
            alt=""
            aria-hidden="true"
            onLoad={(event) => setSmallImage(event.currentTarget.naturalWidth < 900)}
            onError={handleImageError}
          />
        </>
      )}
      <div className="hero-scrim" />
      {imageData?.loading && <div className="hero-skeleton" aria-hidden="true" />}
      <div className="hero-slide-copy">
        <span className="hero-kicker">{label}</span>
        <h1>{song.track_name || song.song_id || 'Titre à la une'}</h1>
        <p className="hero-artists">{formatArtists(song.artists) || 'Artiste inconnu'}</p>
        <span className="hero-genre">{song.track_genre || imageData?.genre || 'Genre non renseigné'}</span>
        <div className="hero-actions">
          <Button className="button-primary" disabled={inactive} tabIndex={inactive ? -1 : undefined} onClick={() => onEvent(song, 'play', queue)}>
            <Play size={16} fill="currentColor" /> Écouter
          </Button>
          <Button className="hero-add-button" disabled={inactive} tabIndex={inactive ? -1 : undefined} onClick={() => onEvent(song, 'add')} aria-label={`Ajouter ${song.track_name || 'ce titre'}`}>
            <Plus size={17} /> Ajouter
          </Button>
        </div>
      </div>
      <div className="hero-cover-frame">
        {cover && !failedCover ? (
          <img
            src={cover}
            alt={`Pochette de ${song.track_name || 'ce titre'}`}
            onError={() => setFailedCover(true)}
          />
        ) : (
          <span
            className="hero-cover-fallback"
            role="img"
            aria-label={`Pochette générée pour ${song.track_name || 'ce titre'}`}
            style={{ '--hero-fallback': hashColor(id) }}
          >
            <span>{(song.track_name || 'SH').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span>
          </span>
        )}
      </div>
      <span className="sr-only" aria-live="polite">
        À la une : {song.track_name || 'Titre inconnu'}, {formatArtists(song.artists) || 'artiste inconnu'}
      </span>
    </article>
  );
}

export function HeroControls({ slides, index, goTo, next, previous }) {
  if (!slides.length) return null;
  return (
    <div className="hero-controls" aria-label="Commandes du carrousel">
      <button type="button" className="hero-arrow" onClick={previous} aria-label="Diapositive précédente" disabled={slides.length < 2}>
        <ChevronLeft size={18} />
      </button>
      <div className="hero-indicators" role="group" aria-label="Choisir une diapositive">
        {slides.map((slide, position) => (
          <button
            key={slide.song_id || position}
            type="button"
            className={`hero-indicator ${position === index ? 'is-active' : ''}`}
            onClick={() => goTo(position)}
            aria-label={`Afficher le titre ${position + 1} : ${slide.track_name || 'Titre inconnu'}`}
            aria-current={position === index ? 'true' : undefined}
          />
        ))}
      </div>
      <button type="button" className="hero-arrow" onClick={next} aria-label="Diapositive suivante" disabled={slides.length < 2}>
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

export default function HeroBanner({ slides, queue, onEvent, loading, error, onRetry }) {
  const reducedMotion = useReducedMotion();
  const carousel = useCarousel(slides.length, reducedMotion);
  const images = useHeroImages(slides, carousel.index);
  const touchStart = useRef(null);
  const pointerInside = useRef(false);
  const focusInside = useRef(false);
  const previousSlide = useRef(null);
  const [outgoingSlide, setOutgoingSlide] = useState(null);
  const currentSong = slides[carousel.index];
  const id = String(currentSong?.song_id || currentSong?.id || '');
  const currentImageData = images[id];
  useEffect(() => {
    if (!currentSong) {
      previousSlide.current = null;
      setOutgoingSlide(null);
      return undefined;
    }
    const previous = previousSlide.current;
    if (previous && previous.id !== id && !reducedMotion) {
      setOutgoingSlide(previous);
      const timer = window.setTimeout(() => setOutgoingSlide(null), 560);
      previousSlide.current = { id, song: currentSong, imageData: currentImageData };
      return () => window.clearTimeout(timer);
    }
    previousSlide.current = { id, song: currentSong, imageData: currentImageData };
    setOutgoingSlide(null);
    return undefined;
  }, [id, reducedMotion]);
  useEffect(() => {
    if (currentSong && previousSlide.current?.id === id) {
      previousSlide.current = { id, song: currentSong, imageData: currentImageData };
    }
  }, [id, currentSong, currentImageData]);

  if (loading) {
    return (
      <section className="hero-banner hero-banner-skeleton" aria-label="À la une" aria-busy="true">
        <div className="hero-skeleton hero-skeleton-initial" />
        <span className="sr-only">Chargement des titres à la une…</span>
      </section>
    );
  }
  if (!currentSong) {
    return (
      <section className="hero-banner hero-banner-state" aria-label="À la une">
        <div className="hero-state-copy">
          <span className="hero-kicker">À LA UNE</span>
          <h1>La musique de la communauté</h1>
          <p>{error || 'Aucun titre à afficher pour le moment.'}</p>
          {onRetry && <Button className="button-secondary" onClick={onRetry}>Réessayer</Button>}
        </div>
      </section>
    );
  }

  const handleFocus = (event) => {
    if (event.type === 'focus') {
      focusInside.current = true;
      carousel.pause();
    } else if (!event.currentTarget.contains(event.relatedTarget)) {
      focusInside.current = false;
      if (!pointerInside.current) carousel.resume();
    }
  };
  const handleMouseEnter = () => {
    pointerInside.current = true;
    carousel.pause();
  };
  const handleMouseLeave = () => {
    pointerInside.current = false;
    if (!focusInside.current) carousel.resume();
  };
  const handleTouchStart = (event) => {
    touchStart.current = event.changedTouches[0].clientX;
  };
  const handleTouchEnd = (event) => {
    if (touchStart.current == null || slides.length < 2) return;
    const delta = event.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(delta) > 48) (delta > 0 ? carousel.previous : carousel.next)();
    touchStart.current = null;
  };

  return (
    <section
      className={`hero-banner ${reducedMotion ? 'hero-reduced-motion' : ''}`}
      role="region"
      aria-roledescription="carrousel"
      aria-label="À la une : les titres les plus écoutés"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleFocus}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {outgoingSlide && (
        <HeroSlide
          key={`outgoing-${outgoingSlide.id}`}
          song={outgoingSlide.song}
          imageData={outgoingSlide.imageData}
          onEvent={onEvent}
          queue={queue}
          inactive
        />
      )}
      <HeroSlide
        key={id}
        song={currentSong}
        imageData={currentImageData}
        onEvent={onEvent}
        queue={queue}
      />
      <HeroControls
        slides={slides}
        index={carousel.index}
        goTo={carousel.goTo}
        next={carousel.next}
        previous={carousel.previous}
      />
      {error && (
        <div className="hero-fallback-notice" role="status">
          <span>Classement indisponible : affichage du catalogue.</span>
          {onRetry && <button type="button" onClick={onRetry}>Réessayer</button>}
        </div>
      )}
    </section>
  );
}
