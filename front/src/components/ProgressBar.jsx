import { memo } from 'react';

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

export default memo(function ProgressBar({ position, duration, disabled, onSeek, compact = false }) {
  return (
    <div className={`progress-control ${compact ? 'progress-compact' : ''}`}>
      <span className="progress-time">{formatTime(position)}</span>
      <input
        type="range"
        min="0"
        max={duration || 0}
        step="0.1"
        value={Math.min(position, duration || 0)}
        onChange={(event) => onSeek(Number(event.target.value))}
        disabled={disabled}
        aria-label="Position de lecture"
        aria-valuemin="0"
        aria-valuemax={Math.round(duration || 0)}
        aria-valuenow={Math.round(position)}
        aria-valuetext={`${formatTime(position)} sur ${formatTime(duration)}`}
      />
      <span className="progress-time">{formatTime(duration)}</span>
    </div>
  );
});
