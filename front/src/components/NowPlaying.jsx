import { useCallback, useEffect, useRef, useState } from 'react';
import { Clapperboard, FileText, Heart, Image, ListMusic, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, X } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext.jsx';
import useCoverColor from '../hooks/useCoverColor.js';
import { SongCover, formatArtists } from '../components.jsx';
import NowPlayingLyrics from './NowPlayingLyrics.jsx';
import ProgressBar from './ProgressBar.jsx';
import VolumeControl from './VolumeControl.jsx';
import QueuePanel from './QueuePanel.jsx';
import SpotifyEmbed from './SpotifyEmbed.jsx';
import DynamicBackground from './player/DynamicBackground.jsx';
import Recommendations from './player/Recommendations.jsx';

export default function NowPlaying({ onAdd, backgroundMode: initialBackgroundMode = 'cover' }) {
  const player = usePlayer();
  const song = player.current;
  const category = song?.track_genre || song?.mood;
  const coverUrl = player.media?.cover_url;
  const accent = useCoverColor(song?.song_id || song?.id, coverUrl);
  const videoUrl = song?.video_url || song?.videoUrl || '';
  const [addStatus, setAddStatus] = useState('idle');
  const [favorite, setFavorite] = useState(false);
  const [activePanel, setActivePanel] = useState('lyrics');
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [backgroundMode, setBackgroundMode] = useState(initialBackgroundMode);
  const [dynamicText, setDynamicText] = useState('#f5f6f2');
  const lyricsPanelRef = useRef(null);
  const bodyRef = useRef(null);
  useEffect(() => { setAddStatus('idle'); setFavorite(false); }, [song?.song_id || song?.id]);
  useEffect(() => {
    if (player.nowPlayingOpen) bodyRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [player.nowPlayingOpen, song?.song_id, song?.id]);
  const spotify = player.media?.source === 'spotify';
  const unavailable = player.unavailable;
  const lyricsPosition = spotify ? player.spotifyPosition || 0 : player.position;
  const canSeekLyrics = !spotify && player.media?.source === 'local' && !unavailable;
  const spotifyProgressAvailable = Number.isFinite(player.spotifyPosition)
    && player.spotifyPosition >= 0
    && Number.isFinite(player.spotifyDuration)
    && player.spotifyDuration > 0;
  const fallbackToCover = useCallback(() => setBackgroundMode('cover'), []);
  const toggleMobilePanel = (panel) => {
    if (panel === 'lyrics') {
      setActivePanel('lyrics');
      setMobilePanelOpen(false);
      lyricsPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (mobilePanelOpen && activePanel === panel) {
      setMobilePanelOpen(false);
      return;
    }
    setActivePanel(panel);
    setMobilePanelOpen(true);
  };
  const handleAdd = async () => {
    if (!song || addStatus === 'sending' || addStatus === 'added') return;
    setAddStatus('sending');
    try {
      const success = await onAdd?.(song, 'add');
      setAddStatus(success === false ? 'idle' : 'added');
    } catch {
      setAddStatus('idle');
    }
  };

  return (
    <section
      className={`now-playing ${player.nowPlayingOpen ? 'is-open' : 'is-closed'}`}
      style={{ '--now-accent': accent, '--dynamic-text': dynamicText }}
      role="dialog"
      aria-modal={player.nowPlayingOpen ? 'true' : undefined}
      aria-label="En cours de lecture"
      aria-hidden={!player.nowPlayingOpen}
      hidden={!player.nowPlayingOpen}
    >
      <DynamicBackground
        song={song}
        coverUrl={coverUrl}
        mode={backgroundMode}
        position={spotify ? lyricsPosition : player.position}
        playing={player.nowPlayingOpen && player.playing}
        onVideoUnavailable={fallbackToCover}
        onTextColor={setDynamicText}
      />
      <header className="now-playing-header">
        <span className="now-context">Lecture en cours · {player.contextLabel || 'Catalogue'}</span>
        <div className="player-background-switch" role="group" aria-label="Fond du lecteur">
          <button
            type="button"
            className={backgroundMode === 'cover' ? 'is-selected' : ''}
            onClick={() => setBackgroundMode('cover')}
            aria-pressed={backgroundMode === 'cover'}
            aria-label="Utiliser le fond coloré de la pochette"
          ><Image size={15} /><span>Pochette</span></button>
          <button
            type="button"
            className={backgroundMode === 'video' ? 'is-selected' : ''}
            onClick={() => setBackgroundMode('video')}
            disabled={!videoUrl}
            aria-pressed={backgroundMode === 'video'}
            aria-label={videoUrl ? 'Utiliser la vidéo en fond' : 'Aucune vidéo de fond disponible'}
            title={videoUrl ? 'Vidéo en fond' : 'Aucune vidéo associée à ce titre'}
          ><Clapperboard size={15} /><span>Vidéo</span></button>
        </div>
        <button
          type="button"
          className="lyrics-mobile-toggle"
          onClick={() => toggleMobilePanel('lyrics')}
          aria-expanded={mobilePanelOpen && activePanel === 'lyrics'}
          aria-label={mobilePanelOpen && activePanel === 'lyrics' ? 'Masquer les paroles' : 'Afficher les paroles'}
        >
          <FileText size={17} /><span>Paroles</span>
        </button>
        <button
          type="button"
          className="queue-mobile-toggle"
          onClick={() => toggleMobilePanel('queue')}
          aria-expanded={mobilePanelOpen && activePanel === 'queue'}
          aria-label={mobilePanelOpen && activePanel === 'queue' ? 'Masquer la file d’attente' : `Afficher À suivre, ${player.queue.length} titres`}
        >
          <ListMusic size={17} /><span>À suivre</span>
        </button>
        <button type="button" onClick={() => { setMobilePanelOpen(false); player.setNowPlayingOpen(false); }} aria-label="Fermer la vue en cours de lecture"><X size={20} /></button>
      </header>
      <div className="now-playing-body" ref={bodyRef}>
        <div className="now-playing-main">
          <div className="now-playing-left">
            <div className="now-cover-wrap">
              {song ? <SongCover song={song} size="lg" className="now-playing-cover" /> : <div className="now-empty-cover"><Play size={32} /></div>}
              {song && (
                <button type="button" className={`cover-favorite ${favorite ? 'is-favorite' : ''}`} onClick={() => setFavorite((value) => !value)} aria-label={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'} aria-pressed={favorite}>
                  <Heart size={18} fill={favorite ? 'currentColor' : 'none'} />
                </button>
              )}
            </div>
            <div className="now-playing-meta">
              {category && <span className="genre-badge">{category}</span>}
              <h2 dir="auto">{song?.track_name || song?.title || 'Titre indisponible'}</h2>
              <p dir="auto">{formatArtists(song?.artists || song?.artist) || 'Artiste inconnu'}</p>
              {(song?.album_name || song?.album) && <span className="now-album" dir="auto">{song.album_name || song.album}</span>}
            </div>

            {spotify && (
              <SpotifyEmbed
                uri={`spotify:track:${song.song_id || song.id}`}
                autoplayToken={player.autoplayToken}
                onController={player.setSpotifyController}
                onStarted={player.onSpotifyStarted}
                onUpdate={player.onSpotifyUpdate}
                onEnded={player.next}
                onBlocked={player.setSpotifyBlocked}
              />
            )}
            {spotify && <p className="spotify-limit">Lecture et progression gérées par Spotify.</p>}
            {!spotify && player.spotifyBlocked && (
              <button type="button" className="spotify-launch local-launch" onClick={player.togglePlay}>
                Appuyer pour lancer
              </button>
            )}

            {spotify && spotifyProgressAvailable && (
              <ProgressBar position={player.spotifyPosition} duration={player.spotifyDuration} disabled onSeek={() => {}} />
            )}
            {!spotify && player.media?.source === 'local' && (
              <ProgressBar position={player.position} duration={player.duration} disabled={!song || unavailable || player.media?.source !== 'local'} onSeek={player.seek} />
            )}

            <div className="now-controls">
              <button type="button" className={player.shuffle ? 'is-active' : ''} onClick={() => player.setShuffle(!player.shuffle)} aria-label="Lecture aléatoire"><Shuffle size={18} /></button>
              <button type="button" onClick={player.previous} disabled={!song} aria-label="Titre précédent"><SkipBack size={22} /></button>
              <button type="button" className="now-play" onClick={player.togglePlay} disabled={!song || unavailable} aria-label={player.playing ? 'Mettre en pause' : 'Lire'}>
                {player.playing ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
              </button>
              <button type="button" onClick={player.next} disabled={!song} aria-label="Titre suivant"><SkipForward size={22} /></button>
              <button type="button" className={player.repeat !== 'none' ? 'is-active' : ''} onClick={player.cycleRepeat} aria-label={`Répétition : ${player.repeat}`}>
                {player.repeat === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
              </button>
            </div>
            {unavailable && (
              <div className="unavailable-actions" role="status">
                <strong>Titre indisponible</strong>
                <button type="button" onClick={player.cancelUnavailable}>Annuler le passage automatique</button>
              </div>
            )}
            {!spotify && player.media?.source === 'local' && <VolumeControl volume={player.volume} muted={player.muted} disabled={!song} onVolume={player.setVolume} onMuted={() => player.setMuted(!player.muted)} />}
            {song && (
              <button type="button" className={`now-add ${addStatus === 'added' ? 'now-added' : ''}`} onClick={handleAdd} disabled={addStatus === 'sending' || addStatus === 'added'}>
                {addStatus === 'sending' ? 'Ajout…' : addStatus === 'added' ? 'Ajouté ✓' : 'Ajouter'}
              </button>
            )}
          </div>
        </div>
        <aside className={`now-playing-panel ${mobilePanelOpen ? 'mobile-panel-open' : ''}`} aria-label="Paroles et recommandations">
          <section ref={lyricsPanelRef} className={`player-side-content ${activePanel === 'queue' ? 'queue-view-active' : ''}`}>
            <header className="now-panel-heading">
              <div><span className="player-section-kicker">CHANTER ENSEMBLE</span><h3>Paroles</h3><p dir="auto">{song?.track_name || song?.title || 'Lecture en cours'}</p></div>
              <div className="player-panel-tools">
                <span className="lyrics-sync-indicator">{player.mediaLoading ? 'Chargement…' : 'Synchronisées'}</span>
                <button type="button" className="player-open-queue" onClick={() => { setActivePanel('queue'); setMobilePanelOpen(true); }} aria-label={`Ouvrir la file d’attente, ${player.queue.length} titres`}>
                  <ListMusic size={17} /><span>File</span>
                </button>
              </div>
            </header>
            <div className="player-lyrics-wrap">
              <NowPlayingLyrics
                song={song}
                position={lyricsPosition}
                onSeek={canSeekLyrics ? player.seek : undefined}
                visible={activePanel === 'lyrics'}
              />
            </div>
            <Recommendations song={song} queue={player.queue} />
          </section>
          {activePanel === 'queue' && (
            <div className={`player-queue-overlay ${mobilePanelOpen ? 'is-visible' : ''}`}>
              <QueuePanel onClose={() => { setActivePanel('lyrics'); setMobilePanelOpen(false); }} mobileOpen />
            </div>
          )}
        </aside>
      </div>
      <p className="sr-only" aria-live="polite">{song ? `Lecture en cours : ${song.track_name || song.title} par ${formatArtists(song.artists || song.artist)}` : ''}</p>
    </section>
  );
}
