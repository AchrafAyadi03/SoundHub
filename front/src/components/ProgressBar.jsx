import { memo } from 'react';

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

export default memo(function ProgressBar({ position, duration, disabled, onSeek, compact = false }) {
  const max = duration || 0;
  const current = Math.min(position, max || 0);
  const percent = max > 0 ? Math.min(100, Math.max(0, (current / max) * 100)) : 0;
  const trackStyle = {
    background: `linear-gradient(to right, #6EE7B7 0%, #6EE7B7 ${percent}%, rgba(255,255,255,0.1) ${percent}%, rgba(255,255,255,0.1) 100%)`,
  };

  return (
    <div className={`progress-control group flex w-full items-center gap-2 ${compact ? 'text-[11px]' : 'text-xs'}`}>
      <span className="progress-time min-w-[2.5rem] text-right tabular-nums text-gray-400">{formatTime(position)}</span>
      <input
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full transition-all duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-40 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:opacity-0 [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:duration-200 group-hover:[&::-webkit-slider-thumb]:opacity-100 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:opacity-0 group-hover:[&::-moz-range-thumb]:opacity-100"
        style={trackStyle}
        type="range"
        min="0"
        max={max}
        step="0.1"
        value={current}
        onChange={(event) => onSeek(Number(event.target.value))}
        disabled={disabled}
        aria-label="Position de lecture"
        aria-valuemin={0}
        aria-valuemax={Math.round(max)}
        aria-valuenow={Math.round(current)}
        aria-valuetext={`${formatTime(position)} sur ${formatTime(duration)}`}
      />
      <span className="progress-time min-w-[2.5rem] tabular-nums text-gray-400">{formatTime(duration)}</span>
    </div>
  );
});
