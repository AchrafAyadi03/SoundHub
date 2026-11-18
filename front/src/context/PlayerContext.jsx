import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { api } from '../api.js';
import { getMedia } from '../services/coverService.js';
import useAutoplay from '../hooks/useAutoplay.js';

const PlayerContext = createContext(null);

const initialState = {
  queue: [],
  currentIndex: -1,
  playing: false,
  position: 0,
  duration: 0,
  volume: 0.7,
  muted: false,
  shuffle: false,
  repeat: 'none',
  media: null,
  mediaLoading: false,
  unavailable: false,
  nowPlayingOpen: false,
  queueOpen: false,
  spotifyPosition: null,
  spotifyDuration: null,
  autoplayToken: 0,
  spotifyBlocked: false,
  contextLabel: 'Catalogue',
  unavailableCancelToken: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_QUEUE':
      return {
        ...state,
        queue: action.queue,
        currentIndex: action.index,
        position: 0,
        duration: 0,
        spotifyPosition: null,
        spotifyDuration: null,
      };
    case 'SET_INDEX':
      return {
        ...state,
        currentIndex: action.index,
        position: 0,
        duration: 0,
        spotifyPosition: null,
        spotifyDuration: null,
      };
    case 'PLAYING': return { ...state, playing: action.value };
    case 'POSITION': return { ...state, position: action.value };
    case 'DURATION': return { ...state, duration: action.value };
    case 'VOLUME': return { ...state, volume: action.value };
    case 'MUTED': return { ...state, muted: action.value };
    case 'SHUFFLE': return { ...state, shuffle: action.value };
    case 'REPEAT': return { ...state, repeat: action.value };
    case 'MEDIA': return { ...state, media: action.value, mediaLoading: false, unavailable: action.value?.source === 'none' };
    case 'MEDIA_LOADING': return { ...state, mediaLoading: action.value, unavailable: false };
    case 'UNAVAILABLE': return { ...state, unavailable: true, playing: false };
    case 'NOW_OPEN': return { ...state, nowPlayingOpen: action.value };
    case 'QUEUE_OPEN': return { ...state, queueOpen: action.value };
    case 'REMOVE_QUEUE': {
      const queue = state.queue.filter((_, index) => index !== action.index);
      let currentIndex = state.currentIndex;
      if (action.index < currentIndex) currentIndex -= 1;
      if (action.index === currentIndex) currentIndex = Math.min(currentIndex, queue.length - 1);
      return { ...state, queue, currentIndex };
    }
    case 'MOVE_QUEUE': {
      const queue = [...state.queue];
      const [item] = queue.splice(action.from, 1);
      queue.splice(action.to, 0, item);
      return { ...state, queue };
    }
    case 'CLEAR_QUEUE': return { ...state, queue: [], currentIndex: -1, playing: false };
    case 'SPOTIFY_PROGRESS': return { ...state, spotifyPosition: action.position, spotifyDuration: action.duration };
    case 'AUTOPLAY_TOKEN': return { ...state, autoplayToken: state.autoplayToken + 1, spotifyBlocked: false };
    case 'SPOTIFY_BLOCKED': return { ...state, spotifyBlocked: true };
    case 'CONTEXT_LABEL': return { ...state, contextLabel: action.value };
    case 'UNAVAILABLE_CANCEL': return { ...state, unavailable: false };
    case 'PLAYBACK_BLOCKED': return { ...state, spotifyBlocked: true, playing: false };
    default: return state;
  }
}

export function PlayerProvider({ children, userId, notify }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { audioRef, playLocal } = useAutoplay();
  const lastProgressUpdateRef = useRef(0);
  const playStartedRef = useRef(false);
  const playRequestRef = useRef(0);
  const listRef = useRef([]);
  const current = state.queue[state.currentIndex] || null;
  const currentId = current?.song_id || current?.id;

  listRef.current = state.queue;

  const recordEvent = useCallback(async (song, eventType, listenedMs = 0) => {
    if (!song || !userId?.trim()) return;
    try {
      await api.addEvent({
        user_id: userId.trim(),
        song_id: song.song_id || song.id,
        event_type: eventType,
        duration_listened_ms: listenedMs,
        device: 'web',
      });
    } catch (error) {
      notify?.(`Événement non enregistré : ${error.message}`, 'error');
    }
  }, [notify, userId]);

  const loadMedia = useCallback(async (song) => {
    const id = song?.song_id || song?.id;
    if (!id) return;
    const request = ++playRequestRef.current;
    dispatch({ type: 'MEDIA_LOADING', value: true });
    try {
      const media = await getMedia(id);
      if (request !== playRequestRef.current) return;
      dispatch({ type: 'MEDIA', value: media });
    } catch {
      if (request !== playRequestRef.current) return;
      dispatch({ type: 'MEDIA', value: { source: 'none', cover_url: null } });
    }
  }, []);

  useEffect(() => {
    if (!current) return;
    playStartedRef.current = false;
    dispatch({ type: 'POSITION', value: 0 });
    loadMedia(current);
  }, [currentId, current, loadMedia]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = state.muted ? 0 : state.volume;
  }, [state.volume, state.muted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!state.media || state.media.source !== 'local') return;
    if (audio.getAttribute('src') !== state.media.audio_url) {
      audio.src = state.media.audio_url;
      audio.load();
    }
  }, [state.media, currentId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || state.media?.source !== 'local') return;
    if (state.playing && audio.paused) audio.play().catch(() => dispatch({ type: 'UNAVAILABLE' }));
    else audio.pause();
  }, [state.playing, state.media?.source]);

  const playSong = useCallback((song, queueOverride) => {
    const request = ++playRequestRef.current;
    const queue = queueOverride?.length ? queueOverride : [song];
    const index = Math.max(0, queue.findIndex((item) => (item.song_id || item.id) === (song.song_id || song.id)));
    dispatch({ type: 'SET_QUEUE', queue, index });
    dispatch({ type: 'PLAYING', value: true });
    dispatch({ type: 'NOW_OPEN', value: true });
    playStartedRef.current = false;
    const id = song?.song_id || song?.id;
    if (id) getMedia(id).then((media) => {
      if (request !== playRequestRef.current) return;
      dispatch({ type: 'MEDIA', value: media });
      if (media.source === 'local') {
        playLocal(media.audio_url).then((result) => {
          if (result?.blocked) dispatch({ type: 'PLAYBACK_BLOCKED' });
          else if (!result?.started) dispatch({ type: 'UNAVAILABLE' });
        });
      }
      if (media.source === 'spotify') dispatch({ type: 'AUTOPLAY_TOKEN' });
    });
  }, [playLocal, recordEvent]);

  const next = useCallback((manual = true) => {
    if (!listRef.current.length) return;
    if (manual && current && state.media?.source === 'local' && state.duration > 0 && state.position < state.duration - 1) {
      recordEvent(current, 'skip', Math.round(state.position * 1000));
    }
    if (manual && current && state.media?.source === 'spotify' && state.spotifyPosition > 0) {
      recordEvent(current, 'skip', Math.round(state.spotifyPosition * 1000));
    }
    if (state.shuffle) {
      const index = listRef.current.length > 1
        ? (state.currentIndex + 1 + Math.floor(Math.random() * (listRef.current.length - 1))) % listRef.current.length
        : 0;
      dispatch({ type: 'SET_INDEX', index });
    } else {
      dispatch({ type: 'SET_INDEX', index: (state.currentIndex + 1) % listRef.current.length });
    }
    dispatch({ type: 'PLAYING', value: true });
  }, [state.currentIndex, state.shuffle, state.media?.source, state.position, state.duration, state.spotifyPosition, current, recordEvent]);

  const previous = useCallback(() => {
    if (!listRef.current.length) return;
    if (audioRef.current?.currentTime > 3) {
      audioRef.current.currentTime = 0;
      dispatch({ type: 'POSITION', value: 0 });
      return;
    }
    dispatch({ type: 'SET_INDEX', index: (state.currentIndex - 1 + listRef.current.length) % listRef.current.length });
    dispatch({ type: 'PLAYING', value: true });
  }, [state.currentIndex]);

  const togglePlay = useCallback(() => {
    if (state.media?.source === 'spotify') {
      spotifyControllerRef.current?.togglePlay();
      dispatch({ type: 'PLAYING', value: !state.playing });
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    if (state.playing) {
      audio.pause();
      dispatch({ type: 'PLAYING', value: false });
      return;
    }
    audio.play().catch(() => dispatch({ type: 'PLAYBACK_BLOCKED' }));
  }, [state.playing, state.media?.source]);
  const seek = useCallback((value) => {
    if (audioRef.current && state.media?.source === 'local') {
      audioRef.current.currentTime = value;
      dispatch({ type: 'POSITION', value });
    }
  }, [state.media?.source]);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const now = performance.now();
    if (now - lastProgressUpdateRef.current < 250) return;
    lastProgressUpdateRef.current = now;
    dispatch({ type: 'POSITION', value: audio.currentTime });
    if (Number.isFinite(audio.duration)) dispatch({ type: 'DURATION', value: audio.duration });
  }, []);

  const handleEnded = useCallback(() => {
    if (state.repeat === 'one' && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      return;
    }
    if (state.repeat === 'all' || state.currentIndex < state.queue.length - 1) next(false);
    else dispatch({ type: 'PLAYING', value: false });
  }, [next, state.repeat, state.currentIndex, state.queue.length]);

  const handleError = useCallback(() => dispatch({ type: 'UNAVAILABLE' }), []);
  const handleLocalPlay = useCallback(() => {
    dispatch({ type: 'PLAYING', value: true });
    if (!playStartedRef.current && current) {
      playStartedRef.current = true;
      recordEvent(current, 'play', 0);
    }
  }, [current, recordEvent]);

  useEffect(() => {
    if (!current) return;
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.track_name || current.title || 'Titre',
      artist: current.artists || current.artist || 'Artiste',
      artwork: state.media?.cover_url ? [{ src: state.media.cover_url }] : undefined,
    });
    navigator.mediaSession.setActionHandler('play', () => dispatch({ type: 'PLAYING', value: true }));
    navigator.mediaSession.setActionHandler('pause', () => dispatch({ type: 'PLAYING', value: false }));
    navigator.mediaSession.setActionHandler('previoustrack', previous);
    navigator.mediaSession.setActionHandler('nexttrack', next);
  }, [current, next, previous, state.media?.cover_url]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        dispatch({ type: 'NOW_OPEN', value: false });
        return;
      }
      const tag = event.target?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(tag) || event.target?.isContentEditable) return;
      if (event.code === 'Space') { event.preventDefault(); togglePlay(); }
      if (state.media?.source === 'local' && event.key === 'ArrowLeft') seek(Math.max(0, state.position - 5));
      if (state.media?.source === 'local' && event.key === 'ArrowRight') seek(state.position + 5);
      if (event.key === 'ArrowUp') dispatch({ type: 'VOLUME', value: Math.min(1, state.volume + 0.05) });
      if (event.key === 'ArrowDown') dispatch({ type: 'VOLUME', value: Math.max(0, state.volume - 0.05) });
      if (event.key.toLower?.() === 'm') dispatch({ type: 'MUTED', value: !state.muted });
      if (event.key.toLower?.() === 'n') next();
      if (event.key.toLower?.() === 'p') previous();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [next, previous, seek, state.position, state.volume, state.muted, togglePlay]);

  useEffect(() => () => {
    const audio = audioRef.current;
    if (audio) audio.pause();
  }, []);

  const unavailableTimerRef = useRef(null);
  const spotifyControllerRef = useRef(null);
  useEffect(() => {
    if (!state.unavailable) return;
    clearTimeout(unavailableTimerRef.current);
    unavailableTimerRef.current = setTimeout(() => next(), 2000);
    return () => clearTimeout(unavailableTimerRef.current);
  }, [state.unavailable, next]);

  const cancelUnavailable = useCallback(() => {
    clearTimeout(unavailableTimerRef.current);
    dispatch({ type: 'UNAVAILABLE_CANCEL' });
  }, []);

  const onSpotifyStarted = useCallback(() => {
    if (playStartedRef.current || !current) return;
    playStartedRef.current = true;
    dispatch({ type: 'PLAYING', value: true });
    recordEvent(current, 'play', 0);
  }, [current, recordEvent]);

  const onSpotifyUpdate = useCallback((update) => {
    const toSeconds = (value) => {
      if (value == null || value === '') return null;
      const milliseconds = Number(value);
      return Number.isFinite(milliseconds) && milliseconds >= 0 ? milliseconds / 1000 : null;
    };
    const position = toSeconds(update?.position);
    const duration = toSeconds(update?.duration);
    dispatch({ type: 'SPOTIFY_PROGRESS', position, duration });
    if (update?.isPaused && position !== null && (
      (duration !== null && duration - position <= 1)
      || position >= 29
    )) next();
  }, [next]);

  const value = useMemo(() => ({
    ...state,
    current,
    audioRef,
    playSong,
    togglePlay,
    next,
    previous,
    seek,
    handleTimeUpdate,
    handleEnded,
    handleError,
    handleLocalPlay,
    recordEvent,
    setVolume: (volume) => dispatch({ type: 'VOLUME', value: volume }),
    setMuted: (value) => dispatch({ type: 'MUTED', value }),
    setShuffle: (value) => dispatch({ type: 'SHUFFLE', value }),
    cycleRepeat: () => dispatch({ type: 'REPEAT', value: state.repeat === 'none' ? 'all' : state.repeat === 'all' ? 'one' : 'none' }),
    setNowPlayingOpen: (value) => dispatch({ type: 'NOW_OPEN', value }),
    setQueueOpen: (value) => dispatch({ type: 'QUEUE_OPEN', value }),
    removeFromQueue: (index) => dispatch({ type: 'REMOVE_QUEUE', index }),
    moveQueue: (from, to) => dispatch({ type: 'MOVE_QUEUE', from, to }),
    clearQueue: () => dispatch({ type: 'CLEAR_QUEUE' }),
    setContextLabel: (value) => dispatch({ type: 'CONTEXT_LABEL', value }),
    cancelUnavailable,
    onSpotifyStarted,
    onSpotifyUpdate,
    setSpotifyBlocked: () => dispatch({ type: 'SPOTIFY_BLOCKED' }),
    setSpotifyController: (controller) => { spotifyControllerRef.current = controller; },
    toggleSpotify: () => spotifyControllerRef.current?.togglePlay(),
  }), [state, current, playSong, togglePlay, next, previous, seek, handleTimeUpdate, handleEnded, handleError, handleLocalPlay, recordEvent, cancelUnavailable, onSpotifyStarted, onSpotifyUpdate]);

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        preload="metadata"
        onPlay={handleLocalPlay}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}
        onEnded={handleEnded}
        onError={handleError}
      />
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const value = useContext(PlayerContext);
  if (!value) throw new Error('usePlayer doit être utilisé dans PlayerProvider');
  return value;
}
