import { useEffect, useState } from 'react';

export function hashColor(id = '') {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 24% 28%)`;
}

export default function useCoverColor(songId, coverUrl) {
  const [color, setColor] = useState(hashColor(String(songId || 'soundhub')));

  useEffect(() => {
    setColor(hashColor(String(songId || 'soundhub')));
    if (!coverUrl || typeof document === 'undefined') return;
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 16;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0, 16, 16);
        const data = context.getImageData(0, 0, 16, 16).data;
        let r = 0;
        let g = 0;
        let b = 0;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i]; g += data[i + 1]; b += data[i + 2];
        }
        const count = data.length / 4;
        setColor(`rgb(${Math.round(r / count)} ${Math.round(g / count)} ${Math.round(b / count)})`);
      } catch {
        setColor(hashColor(String(songId || 'soundhub')));
      }
    };
    image.onerror = () => setColor(hashColor(String(songId || 'soundhub')));
    image.src = coverUrl;
  }, [songId, coverUrl]);
  return color;
}
