import { useEffect, useRef, useState } from 'react';

let spotifyScriptPromise = null;

function loadSpotifyApi() {
  if (window.SpotifyIframeApi) return Promise.resolve(window.SpotifyIframeApi);
  if (spotifyScriptPromise) return spotifyScriptPromise;
  spotifyScriptPromise = new Promise((resolve, reject) => {
    const previousReady = window.onSpotifyIframeApiReady;
    window.onSpotifyIframeApiReady = (api) => {
      window.SpotifyIframeApi = api;
      previousReady?.(api);
      resolve(api);
    };
    const script = document.querySelector('script[src="https://open.spotify.com/embed/iframe-api/v1"]');
    if (!script) {
      const element = document.createElement('script');
      element.src = 'https://open.spotify.com/embed/iframe-api/v1';
      element.async = true;
      element.onerror = () => reject(new Error('Chargement Spotify impossible'));
      document.head.appendChild(element);
    }
  });
  return spotifyScriptPromise;
}

function getSpotifyUrl(uri) {
  const match = /^spotify:(track|episode):([A-Za-z0-9]+)$/.exec(uri || '');
  return match
    ? `https://open.spotify.com/${match[1]}/${encodeURIComponent(match[2])}?theme=0`
    : null;
}

export default function SpotifyEmbed({ uri, autoplayToken = 0, onController, onStarted, onUpdate, onEnded, onBlocked }) {
  const hostRef = useRef(null);
  const controllerRef = useRef(null);
  const startedRef = useRef(false);
  const blockedTimerRef = useRef(null);
  const lastUpdateRef = useRef(null);
  const [blocked, setBlocked] = useState(false);
  const endedRef = useRef(false);
  const callbacksRef = useRef({ onController, onStarted, onUpdate, onEnded, onBlocked });
  callbacksRef.current = { onController, onStarted, onUpdate, onEnded, onBlocked };

  useEffect(() => {
    let disposed = false;
    loadSpotifyApi().then((api) => {
      if (disposed || !hostRef.current) return;
      const url = getSpotifyUrl(uri);
      api.createController(hostRef.current, { ...(url ? { url } : { uri }), width: '100%', height: 80 }, (controller) => {
        if (disposed) {
          controller.destroy?.();
          return;
        }
        controllerRef.current = controller;
        callbacksRef.current.onController?.(controller);
        controller.addListener('ready', () => {
          endedRef.current = false;
          startedRef.current = false;
          lastUpdateRef.current = null;
          setBlocked(false);
          controller.play();
          clearTimeout(blockedTimerRef.current);
          blockedTimerRef.current = setTimeout(() => {
            if (!startedRef.current) {
              setBlocked(true);
              callbacksRef.current.onBlocked?.();
            }
          }, 2000);
        });
        controller.addListener('playback_started', () => {
          startedRef.current = true;
          clearTimeout(blockedTimerRef.current);
          setBlocked(false);
          callbacksRef.current.onStarted?.();
        });
        controller.addListener('playback_update', (event) => {
          const data = event?.data || event;
          callbacksRef.current.onUpdate?.(data);
          const position = Number(data?.position);
          const duration = Number(data?.duration);
          const previousUpdate = lastUpdateRef.current;
          if (data?.isPaused
            && previousUpdate?.isPaused === false
            && Number.isFinite(duration)
            && duration > 0
            && Number.isFinite(position)
            && position >= duration - 500
            && !endedRef.current) {
            endedRef.current = true;
            callbacksRef.current.onEnded?.();
          }
          lastUpdateRef.current = data;
        });
      });
    }).catch(() => callbacksRef.current.onBlocked?.());
    return () => {
      disposed = true;
      clearTimeout(blockedTimerRef.current);
      controllerRef.current?.destroy?.();
      callbacksRef.current.onController?.(null);
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller || !uri) return;
    endedRef.current = false;
    startedRef.current = false;
    lastUpdateRef.current = null;
    setBlocked(false);
    clearTimeout(blockedTimerRef.current);
    controller.loadUri(uri, false, undefined, 'dark');
    controller.play();
    blockedTimerRef.current = setTimeout(() => {
      if (!startedRef.current) {
        setBlocked(true);
        callbacksRef.current.onBlocked?.();
      }
    }, 2000);
  }, [uri]);

  const toggle = () => controllerRef.current?.togglePlay();

  return (
    <div className="spotify-embed">
      <div ref={hostRef} className="spotify-embed-host" />
      {blocked && (
        <button type="button" className="spotify-launch" onClick={() => {
          setBlocked(false);
          clearTimeout(blockedTimerRef.current);
          controllerRef.current?.play();
        }}>
          Appuyer pour lancer
        </button>
      )}
      <button type="button" className="sr-only" onClick={toggle} aria-label="Lecture ou pause Spotify">Contrôle Spotify</button>
    </div>
  );
}
