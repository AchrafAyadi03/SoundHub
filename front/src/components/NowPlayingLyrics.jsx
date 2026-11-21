import { useEffect, useMemo, useRef, useState } from 'react';
import { Music2 } from 'lucide-react';
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
      const line = activeLineRef.current;
      const list = line?.parentElement;
      if (!line || !list) return;
      const lineRect = line.getBoundingClientRect();
      const listRect = list.getBoundingClientRect();
      const target = list.scrollTop + lineRect.top - listRect.top - list.clientHeight / 2 + lineRect.height / 2;
      list.scrollTo({
        top: target,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
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
      <div
        className="now-lyrics-list [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)] [-webkit-mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)]"
        aria-label={`Paroles de ${title}`}
        dir="auto"
      >
        {entries.map((line, index) => {
          const isCurrent = index === currentLine;
          const isNearby = Math.abs(index - currentLine) === 1;
          return (
            <button
              type="button"
              className={`now-lyric-line block w-full border-0 bg-transparent px-2 py-2 text-left transition-all duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                isCurrent
                  ? 'is-current scale-105 text-2xl font-bold text-white'
                  : isNearby
                    ? 'is-nearby text-lg font-medium text-gray-400 opacity-80'
                    : 'is-distant text-base text-gray-500 opacity-60'
              } ${onSeek ? 'cursor-pointer' : 'cursor-default'}`}
              key={`${line.time}-${index}`}
              ref={isCurrent ? activeLineRef : null}
              onClick={() => onSeek?.(line.time)}
              disabled={!onSeek}
              aria-current={isCurrent ? 'true' : undefined}
              aria-label={`Aller à ${Math.floor(line.time / 60)}:${String(Math.floor(line.time % 60)).padStart(2, '0')} — ${line.text}`}
              dir="auto"
            >
              {line.text || '♪'}
            </button>
          );
        })}
      </div>
    );
  }

  if (result.lyrics.plainLyrics) {
    return (
      <div
        className="now-lyrics-list now-plain-lyrics [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)] [-webkit-mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)]"
        aria-label={`Paroles de ${title}`}
        dir="auto"
      >
        {result.lyrics.plainLyrics.split(/\r?\n/).filter(Boolean).map((line, index) => (
          <p className="now-lyric-line py-2 text-base text-gray-500 opacity-60" dir="auto" key={`${index}-${line}`}>{line}</p>
        ))}
      </div>
    );
  }
  return <LyricsMessage title="Paroles indisponibles" description="Aucune parole n’a été trouvée pour ce titre." />;
}
