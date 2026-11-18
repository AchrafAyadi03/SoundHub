import { memo } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

export default memo(function VolumeControl({ volume, muted, disabled, onVolume, onMuted }) {
  return (
    <div className="volume-control">
      <button type="button" onClick={onMuted} disabled={disabled} aria-label={muted ? 'Rétablir le son' : 'Couper le son'}>
        {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={muted ? 0 : volume}
        onChange={(event) => onVolume(Number(event.target.value))}
        disabled={disabled}
        aria-label="Volume"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={Math.round((muted ? 0 : volume) * 100)}
        aria-valuetext={`${Math.round((muted ? 0 : volume) * 100)} pour cent`}
      />
    </div>
  );
});
