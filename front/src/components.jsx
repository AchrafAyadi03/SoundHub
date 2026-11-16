import { useEffect } from 'react';
import { AlertCircle, Check, Music2, X } from 'lucide-react';

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
  const id = String(song?.song_id || song?.track_name || 'soundhub');
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  const style = { '--cover-hue': hue, '--cover-hue-next': (hue + 56) % 360 };
  return (
    <span className={`song-cover cover-${size} ${className}`} style={style} aria-hidden="true">
      <Music2 size={size === 'small' ? 19 : 25} strokeWidth={1.5} />
      {size !== 'small' && <span className="cover-orbit" />}
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

export function ErrorState({ message, onRetry, compact = false }) {
  return (
    <div className={`state-card error-state ${compact ? 'state-compact' : ''}`} role="alert">
      <span className="state-icon"><AlertCircle size={20} /></span>
      <strong>Les données ne sont pas disponibles</strong>
      <p>{message ? `${message} — Vérifiez que l’API et Cassandra sont accessibles.` : 'Vérifiez que l’API et Cassandra sont démarrées, puis réessayez.'}</p>
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
  if (!e.track_name) return <span className="muted">{e.song_id}</span>;
  return <span className="song-cell"><strong>{e.track_name}</strong><span className="muted">{e.artists}</span></span>;
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
