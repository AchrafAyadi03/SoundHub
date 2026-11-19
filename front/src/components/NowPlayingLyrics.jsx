import { useEffect, useMemo, useRef, useState } from 'react';
import { LoaderCircle, Music2 } from 'lucide-react';
import { formatArtists } from '../components.jsx';
import { fetchLyrics, parseLRC } from '../services/lyrics.js';

function activeLineIndex(lines, position) {
  if (typeof lines.findLastIndex === 'function') {
    return lines.findLastIndex((line) => line.time <= position);
  }
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index].time <= position) return index;
  }
  return -1;
}

function LyricsMessage({ title, description, onRetry }) {
  return (
    <div className="now-lyrics-message" role="status">
      <Music2 size={22} aria-hidden="true" />
      <strong>{title}</strong>
      <span>{description}</span>
      {onRetry && <button type="button" onClick={onRetry}>Réessayer</button>}
    </div>
  );
}

export default function NowPlayingLyrics({ song, position = 0, onSeek, visible = true }) {
  const [result, setResult] = useState({ status: 'loading', lyrics: null });
  const [retry, setRetry] = useState(0);
  const activeLineRef = useRef(null);
  const artist = useMemo(
    () => String(song?.artists || song?.artist || '').split(';')[0].trim(),
    [song?.artists, song?.artist],
  );
  const title = song?.track_name || song?.title || '';
  const album = song?.album_name || '';
  const duration = Number(song?.duration_ms) > 0 ? Number(song.duration_ms) / 1000 : undefined;
  const songKey = `${song?.song_id || song?.id || ''}|${artist}|${title}`;

  useEffect(() => {
    if (!title || !artist) {
      setResult({ status: 'empty', lyrics: null });
      return undefined;
    }
    const controller = new AbortController();
    setResult({ status: 'loading', lyrics: null });
    fetchLyrics({ title, artist, album, duration }, controller.signal)
      .then((lyrics) => {
        if (!controller.signal.aborted) {
          setResult({ status: lyrics ? 'ready' : 'empty', lyrics });
        }
      })
      .catch((error) => {
        if (error.name !== 'AbortError' && !controller.signal.aborted) {
          setResult({ status: 'error', lyrics: null });
        }
      });
    return () => controller.abort();
  }, [songKey, retry]);

  const entries = useMemo(
    () => result.lyrics?.syncedLyrics ? parseLRC(result.lyrics.syncedLyrics) : [],
    [result.lyrics],
  );
  const currentLine = activeLineIndex(entries, Number(position) || 0);

  useEffect(() => {
    if (visible && currentLine >= 0) {
      activeLineRef.current?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'center',
      });
    }
  }, [currentLine, visible]);

  if (result.status === 'loading') {
    return (
      <div className="now-lyrics-list lyrics-loading" aria-label="Chargement des paroles" aria-busy="true">
        {Array.from({ length: 6 }, (_, index) => <span className="lyrics-skeleton" key={index} />)}
      </div>
    );
  }
  if (result.status === 'error') {
    return (
      <LyricsMessage
        title="Paroles indisponibles"
        description="La connexion au service de paroles a échoué."
        onRetry={() => setRetry((value) => value + 1)}
      />
    );
  }
  if (!result.lyrics) {
    return <LyricsMessage title="Paroles indisponibles" description="Aucune parole n’a été trouvée pour ce titre." />;
  }
  if (result.lyrics.instrumental) {
    return <LyricsMessage title="Instrumental" description="Ce morceau ne contient pas de paroles." />;
  }

  if (entries.length) {
    return (
      <div className="now-lyrics-list" aria-label={`Paroles de ${title}`}>
        {entries.map((line, index) => (
          <button
            type="button"
            className={`now-lyric-line ${index === currentLine ? 'is-current' : Math.abs(index - currentLine) === 1 ? 'is-nearby' : 'is-distant'}`}
            key={`${line.time}-${index}`}
            ref={index === currentLine ? activeLineRef : null}
            onClick={() => onSeek?.(line.time)}
            disabled={!onSeek}
            aria-current={index === currentLine ? 'true' : undefined}
            aria-label={`Aller à ${Math.floor(line.time / 60)}:${String(Math.floor(line.time % 60)).padStart(2, '0')} — ${line.text}`}
          >
            {line.text || '♪'}
          </button>
        ))}
      </div>
    );
  }

  if (result.lyrics.plainLyrics) {
    return (
      <div className="now-lyrics-list now-plain-lyrics" aria-label={`Paroles de ${title}`}>
        {result.lyrics.plainLyrics.split(/\r?\n/).filter(Boolean).map((line, index) => (
          <p className="now-lyric-line" key={`${index}-${line}`}>{line}</p>
        ))}
      </div>
    );
  }
  return <LyricsMessage title="Paroles indisponibles" description="Aucune parole n’a été trouvée pour ce titre." />;
}
