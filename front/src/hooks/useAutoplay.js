import { useCallback, useRef } from 'react';

export default function useAutoplay() {
  const audioRef = useRef(null);
  const blockedRef = useRef(false);

  const playLocal = useCallback(async (audioUrl) => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return false;
    audio.src = audioUrl;
    audio.load();
    try {
      await audio.play();
      blockedRef.current = false;
      return { started: true };
    } catch (error) {
      blockedRef.current = error?.name === 'NotAllowedError';
      return { started: false, blocked: blockedRef.current };
    }
  }, []);

  return { audioRef, playLocal, blockedRef };
}
