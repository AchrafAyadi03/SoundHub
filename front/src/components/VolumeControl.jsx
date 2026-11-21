import { memo } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

export default memo(function VolumeControl({ volume, muted, disabled, disabledReason, onVolume, onMuted }) {
  const current = muted ? 0 : volume;
  const percent = Math.min(100, Math.max(0, current * 100));
  const trackStyle = {
    background: `linear-gradient(to right, #6EE7B7 0%, #6EE7B7 ${percent}%, rgba(255,255,255,0.1) ${percent}%, rgba(255,255,255,0.1) 100%)`,
  };

  return (
    <div className="volume-control group flex items-center gap-2" title={disabledReason}>
      <button
        type="button"
        onClick={onMuted}
        disabled={disabled}
        aria-label={muted ? 'Rétablir le son' : 'Couper le son'}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-300 transition-all duration-200 ease-in-out hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
      <input
        className="h-1.5 w-24 cursor-pointer appearance-none rounded-full transition-all duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-40 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:opacity-0 [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:duration-200 group-hover:[&::-webkit-slider-thumb]:opacity-100 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:opacity-0 group-hover:[&::-moz-range-thumb]:opacity-100"
        style={trackStyle}
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={current}
        onChange={(event) => onVolume(Number(event.target.value))}
        disabled={disabled}
        aria-label="Volume"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        aria-valuetext={`${Math.round(percent)} pour cent`}
      />
    </div>
  );
});
