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

export default function SpotifyEmbed({ uri, autoplayToken = 0, onController, onStarted, onUpdate, onEnded, onBlocked }) {
  const hostRef = useRef(null);
  const controllerRef = useRef(null);
  const startedRef = useRef(false);
  const blockedTimerRef = useRef(null);
  const [blocked, setBlocked] = useState(false);
  const endedRef = useRef(false);
  const callbacksRef = useRef({ onController, onStarted, onUpdate, onEnded, onBlocked });
  callbacksRef.current = { onController, onStarted, onUpdate, onEnded, onBlocked };

  useEffect(() => {
    let disposed = false;
    loadSpotifyApi().then((api) => {
      if (disposed || !hostRef.current) return;
      api.createController(hostRef.current, { uri, width: '100%', height: 80 }, (controller) => {
        if (disposed) {
          controller.destroy?.();
          return;
        }
        controllerRef.current = controller;
        callbacksRef.current.onController?.(controller);
        controller.addListener('ready', () => {
          endedRef.current = false;
          startedRef.current = false;
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
          if (data?.isPaused && (
            (Number.isFinite(duration) && Number.isFinite(position) && duration - position <= 1000)
            || (Number.isFinite(position) && position >= 29000)
          ) && !endedRef.current) {
            endedRef.current = true;
            callbacksRef.current.onEnded?.();
          }
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
    setBlocked(false);
    clearTimeout(blockedTimerRef.current);
    controller.loadUri(uri);
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
