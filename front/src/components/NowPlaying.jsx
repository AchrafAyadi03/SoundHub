import { useEffect, useState } from 'react';
import { FileText, Heart, ListMusic, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, X } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext.jsx';
import useCoverColor from '../hooks/useCoverColor.js';
import { SongCover, formatArtists } from '../components.jsx';
import NowPlayingLyrics from './NowPlayingLyrics.jsx';
import ProgressBar from './ProgressBar.jsx';
import VolumeControl from './VolumeControl.jsx';
import QueuePanel from './QueuePanel.jsx';
import SpotifyEmbed from './SpotifyEmbed.jsx';

export default function NowPlaying({ onAdd }) {
  const player = usePlayer();
  const song = player.current;
  const category = song?.track_genre || song?.mood;
  const coverUrl = player.media?.cover_url;
  const accent = useCoverColor(song?.song_id || song?.id, coverUrl);
  const [addStatus, setAddStatus] = useState('idle');
  const [favorite, setFavorite] = useState(false);
  const [activePanel, setActivePanel] = useState('lyrics');
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  useEffect(() => { setAddStatus('idle'); setFavorite(false); }, [song?.song_id || song?.id]);
  const spotify = player.media?.source === 'spotify';
  const unavailable = player.unavailable;
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches;
  const lyricsPosition = spotify ? player.spotifyPosition || 0 : player.position;
  const canSeekLyrics = !spotify && player.media?.source === 'local' && !unavailable;
  const spotifyProgressAvailable = Number.isFinite(player.spotifyPosition)
    && player.spotifyPosition >= 0
    && Number.isFinite(player.spotifyDuration)
    && player.spotifyDuration > 0;
  const toggleMobilePanel = (panel) => {
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
      style={{ '--now-accent': accent }}
      role="dialog"
      aria-modal={player.nowPlayingOpen ? 'true' : undefined}
      aria-label="En cours de lecture"
      aria-hidden={!player.nowPlayingOpen}
      hidden={!player.nowPlayingOpen}
    >
      <header className="now-playing-header">
        <span className="now-context">Lecture en cours · {player.contextLabel || 'Catalogue'}</span>
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
      <div className="now-playing-body">
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
              <h2>{song?.track_name || song?.title || 'Titre indisponible'}</h2>
              <p>{formatArtists(song?.artists || song?.artist) || 'Artiste inconnu'}</p>
              {song?.album_name && <span className="now-album">{song.album_name}</span>}
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
        <aside className={`now-playing-panel ${mobilePanelOpen ? 'mobile-panel-open' : ''}`} aria-label="Paroles et file d’attente">
          <div className="now-panel-tabs" role="tablist" aria-label="Contenu du lecteur">
            <button type="button" role="tab" id="now-tab-lyrics" aria-selected={activePanel === 'lyrics'} aria-controls="now-panel-lyrics" onClick={() => setActivePanel('lyrics')}>Paroles</button>
            <button type="button" role="tab" id="now-tab-queue" aria-selected={activePanel === 'queue'} aria-controls="now-panel-queue" onClick={() => setActivePanel('queue')}>À suivre</button>
          </div>
          <section
            id="now-panel-lyrics"
            className="now-panel-view now-panel-lyrics"
            role="tabpanel"
            aria-labelledby="now-tab-lyrics"
            hidden={activePanel !== 'lyrics'}
          >
            <header className="now-panel-heading">
              <div><h3>Paroles</h3><p>{song?.track_name || song?.title || 'Lecture en cours'}</p></div>
              <span className="lyrics-sync-indicator">{player.mediaLoading ? 'Chargement…' : 'Synchronisées'}</span>
            </header>
            <NowPlayingLyrics
              song={song}
              position={lyricsPosition}
              onSeek={canSeekLyrics ? player.seek : undefined}
              visible={activePanel === 'lyrics' && (!isMobile || mobilePanelOpen)}
            />
          </section>
          <div
            id="now-panel-queue"
            className="now-panel-view now-panel-queue"
            role="tabpanel"
            aria-labelledby="now-tab-queue"
            hidden={activePanel !== 'queue'}
          >
            {activePanel === 'queue' && (
              <QueuePanel onClose={() => setMobilePanelOpen(false)} mobileOpen={mobilePanelOpen && activePanel === 'queue'} />
            )}
          </div>
        </aside>
      </div>
      <p className="sr-only" aria-live="polite">{song ? `Lecture en cours : ${song.track_name || song.title} par ${formatArtists(song.artists || song.artist)}` : ''}</p>
    </section>
  );
}
