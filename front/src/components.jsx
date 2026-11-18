import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Music2, X } from 'lucide-react';
import { getMedia } from './services/coverService.js';
import { hashColor } from './hooks/useCoverColor.js';

export function Button({ children, className = '', ...props }) {
  return <button className={`button ${className}`} {...props}>{children}</button>;
}

export function Card({ children, className = '' }) {
  return <section className={`card ${className}`}>{children}</section>;
}

const EVENT_LABELS = { play: 'Écoute', skip: 'Passage', add: 'Ajout' };
export function Badge({ type, children }) {
  return <span className={`badge ${type ? `badge-${type}` : ''}`}>{children || EVENT_LABELS[type] || type}</span>;
}
export const TypeBadge = ({ type }) => <Badge type={type} />;

export function Avatar({ name = '?' }) {
  const initials = String(name).trim().slice(0, 2).toUpperCase() || '?';
  return <span className="avatar" aria-hidden="true">{initials}</span>;
}

export function SongCover({ song, size = 'medium', className = '' }) {
  const rootRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [media, setMedia] = useState(null);
  const [failed, setFailed] = useState(false);
  const id = String(song?.song_id || song?.id || 'soundhub');
  const title = song?.track_name || song?.title || 'Titre inconnu';
  const initials = title.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase();

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    if (!('IntersectionObserver' in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '160px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    getMedia(id).then((result) => !cancelled && setMedia(result)).catch(() => !cancelled && setMedia({ source: 'none', cover_url: null }));
    return () => { cancelled = true; };
  }, [id, visible]);

  const dimensions = size === 'sm' || size === 'small' ? 40 : size === 'lg' ? 320 : 160;
  const coverUrl = media?.cover_url;
  const showImage = coverUrl && !failed;
  const fallback = hashColor(id);
  return (
    <span
      ref={rootRef}
      className={`song-cover cover-${size} ${className} ${!media ? 'cover-loading' : ''}`}
      style={{ width: dimensions, height: dimensions, '--cover-hue': fallback }}
      role="img"
      aria-label={`Pochette de ${title}`}
    >
      {showImage ? (
        <img src={coverUrl} width={dimensions} height={dimensions} loading="lazy" decoding="async" alt={`Pochette de ${title}`} onError={() => setFailed(true)} />
      ) : (
        <span className="cover-fallback" aria-hidden="true"><strong>{initials || 'SH'}</strong></span>
      )}
    </span>
  );
}

export function Table({ children, className = '' }) {
  return <div className={`table-wrap ${className}`}><table className="data-table">{children}</table></div>;
}

export function Skeleton({ rows = 4, className = '' }) {
  return (
    <div className={`skeleton-list ${className}`} aria-label="Chargement" aria-busy="true">
      {Array.from({ length: rows }, (_, index) => <span className="skeleton-row" key={index} />)}
    </div>
  );
}

export function EmptyState({ title = 'Aucun résultat', description = 'Essayez de modifier vos filtres.' }) {
  return <div className="state-card"><span className="state-icon"><Music2 size={20} /></span><strong>{title}</strong><p>{description}</p></div>;
}

export function ErrorState({ message, hint, onRetry, compact = false }) {
  return (
    <div className={`state-card error-state ${compact ? 'state-compact' : ''}`} role="alert">
      <span className="state-icon"><AlertCircle size={20} /></span>
      <strong>Les données ne sont pas disponibles</strong>
      <p>{message ? `${message} — ${hint || 'Vérifiez que l’API et Cassandra sont accessibles.'}` : 'Vérifiez que l’API et Cassandra sont démarrées, puis réessayez.'}</p>
      {onRetry && <button className="text-button" onClick={onRetry}>Réessayer</button>}
    </div>
  );
}

export function Toast({ message, tone = 'success', onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3600);
    return () => clearTimeout(timer);
  }, [onClose]);
  return (
    <div className={`toast toast-${tone}`} role="status" aria-live="polite">
      {tone === 'error' ? <AlertCircle size={17} /> : <Check size={17} />}
      <span>{message}</span>
      <button onClick={onClose} aria-label="Fermer la notification"><X size={16} /></button>
    </div>
  );
}

export function LoadingState({ rows = 5 }) {
  return <><Skeleton rows={rows} /><span className="sr-only" aria-live="polite">Chargement des données…</span></>;
}

export function Status({ loading, error, empty, retry }) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (empty) return <EmptyState />;
  return null;
}

export function SongCell({ e }) {
  if (!e.track_name) return <span className="table-song"><SongCover song={e} size="sm" /><span className="muted">{e.song_id}</span></span>;
  return <span className="table-song"><SongCover song={e} size="sm" /><span className="song-cell"><strong>{e.track_name}</strong><span className="muted">{formatArtists(e.artists)}</span></span></span>;
}

export function formatDuration(ms) {
  if (ms == null || Number.isNaN(Number(ms)) || Number(ms) <= 0) return '—';
  const seconds = Math.round(Number(ms) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export const formatDateTime = (iso) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('fr-FR');
};

export const getRows = (result) => Array.isArray(result) ? result : result?.events || result?.songs || result?.data || [];

export function formatArtists(value) {
  return String(value || '')
    .split(';')
    .map((artist) => artist.trim())
    .filter(Boolean)
    .join(', ');
}
