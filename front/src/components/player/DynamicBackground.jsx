import { useEffect, useMemo, useRef, useState } from 'react';

const FALLBACK_COLORS = ['#24312d', '#19231f', '#111713'];

function luminance(hex) {
  const channels = hex.match(/[a-f\d]{2}/gi)?.map((part) => parseInt(part, 16) / 255);
  if (!channels || channels.length !== 3) return 0;
  const [r, g, b] = channels.map((value) => (
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function luminanceAfterVeil(hex) {
  const channels = hex.match(/[a-f\d]{2}/gi)?.map((part) => Math.round(parseInt(part, 16) * 0.24));
  if (!channels) return 0;
  return luminance(`#${channels.map((value) => value.toString(16).padStart(2, '0')).join('')}`);
}

function useDominantColors(url, songId) {
  const [colors, setColors] = useState(FALLBACK_COLORS);

  useEffect(() => {
    let active = true;
    setColors(FALLBACK_COLORS);
    if (!url) return () => { active = false; };

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 32;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('Canvas indisponible');
        context.drawImage(image, 0, 0, 32, 32);
        const pixels = context.getImageData(0, 0, 32, 32).data;
        const buckets = new Map();
        for (let index = 0; index < pixels.length; index += 16) {
          const r = Math.round(pixels[index] / 32) * 32;
          const g = Math.round(pixels[index + 1] / 32) * 32;
          const b = Math.round(pixels[index + 2] / 32) * 32;
          const key = `${Math.min(r, 255)},${Math.min(g, 255)},${Math.min(b, 255)}`;
          buckets.set(key, (buckets.get(key) || 0) + 1);
        }
        const palette = [...buckets.entries()]
          .sort((first, second) => second[1] - first[1])
          .slice(0, 3)
          .map(([rgb]) => `#${rgb.split(',').map((part) => Number(part).toString(16).padStart(2, '0')).join('')}`);
        if (active && palette.length) setColors([...palette, ...FALLBACK_COLORS].slice(0, 3));
      } catch {
        if (active) setColors(FALLBACK_COLORS);
      }
    };
    image.onerror = () => { if (active) setColors(FALLBACK_COLORS); };
    image.src = url;
    return () => { active = false; };
  }, [url, songId]);

  return colors;
}

export default function DynamicBackground({
  song,
  coverUrl,
  mode,
  position,
  playing,
  onVideoUnavailable,
  onTextColor,
}) {
  const videoRef = useRef(null);
  const videoUrl = song?.video_url || song?.videoUrl || '';
  const colors = useDominantColors(coverUrl, song?.song_id || song?.id);
  const textColor = useMemo(
    () => colors.reduce((sum, color) => sum + luminanceAfterVeil(color), 0) / colors.length > 0.46 ? '#151713' : '#f5f6f2',
    [colors],
  );

  useEffect(() => { onTextColor?.(textColor); }, [onTextColor, textColor]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;
    if (Number.isFinite(position)) {
      const target = Number.isFinite(video.duration) && video.duration > 0
        ? position % video.duration
        : position;
      if (Math.abs(video.currentTime - target) > 1.25) video.currentTime = target;
    }
  }, [videoUrl, position]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;
    if (playing) video.play().catch(() => onVideoUnavailable?.());
    else video.pause();
  }, [videoUrl, playing, onVideoUnavailable]);

  return (
    <div
      className={`dynamic-player-background ${mode === 'video' && videoUrl ? 'has-video' : 'cover-mode'}`}
      style={{
        '--bg-1': colors[0],
        '--bg-2': colors[1],
        '--bg-3': colors[2],
        '--dynamic-text': textColor,
      }}
      aria-hidden="true"
    >
      {mode === 'video' && videoUrl ? (
        <video
          ref={videoRef}
          src={videoUrl}
          className="dynamic-background-video"
          muted
          playsInline
          loop
          preload="metadata"
          onError={() => onVideoUnavailable?.()}
        />
      ) : coverUrl ? (
        <img className="dynamic-background-cover" src={coverUrl} alt="" />
      ) : null}
      <div className="dynamic-background-wash" />
    </div>
  );
}
