import { Expand, ListMusic, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from 'lucide-react';
import { memo } from 'react';
import { usePlayer } from '../context/PlayerContext.jsx';
import { SongCover, formatArtists } from '../components.jsx';
import ProgressBar from './ProgressBar.jsx';
import VolumeControl from './VolumeControl.jsx';

export default memo(function PlayerBar({ onAdd }) {
  const player = usePlayer();
  const song = player.current;
  const spotify = player.media?.source === 'spotify';
  const spotifyProgressAvailable = Number.isFinite(player.spotifyPosition)
    && player.spotifyPosition >= 0
    && Number.isFinite(player.spotifyDuration)
    && player.spotifyDuration > 0;
  const unavailable = player.unavailable;
  const repeatIcon = player.repeat === 'one' ? <Repeat1 size={17} /> : <Repeat size={17} />;

  const add = () => {
    if (!song) return;
    onAdd?.(song, 'add');
  };

  return (
    <footer className="player-bar" aria-label="Lecteur de musique">
      <button type="button" className="player-track" onClick={() => player.setNowPlayingOpen(true)} aria-label="Ouvrir la vue en cours de lecture">
        {song ? <SongCover song={song} size="sm" /> : <span className="player-cover-empty"><Play size={17} /></span>}
        <span className="player-track-meta"><strong>{song?.track_name || song?.title || 'Aucune lecture en cours'}</strong><span>{formatArtists(song?.artists || song?.artist) || 'Choisissez un titre'}</span></span>
      </button>
      <div className="player-center">
        <div className="player-controls">
          <button type="button" onClick={player.previous} disabled={!song} aria-label="Titre précédent"><SkipBack size={17} /></button>
          <button type="button" className={player.shuffle ? 'is-active' : ''} onClick={() => player.setShuffle(!player.shuffle)} aria-label="Activer ou désactiver la lecture aléatoire"><Shuffle size={16} /></button>
          <button type="button" className="player-main-play" onClick={player.togglePlay} disabled={!song || unavailable} aria-label={player.playing ? 'Mettre en pause' : 'Lire'}>
            {player.playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
          <button type="button" onClick={player.next} disabled={!song} aria-label="Titre suivant"><SkipForward size={17} /></button>
          <button type="button" className={player.repeat !== 'none' ? 'is-active' : ''} onClick={player.cycleRepeat} aria-label={`Répétition : ${player.repeat}`}><span>{repeatIcon}</span></button>
        </div>
        {spotify
          ? spotifyProgressAvailable && <ProgressBar position={player.spotifyPosition} duration={player.spotifyDuration} disabled onSeek={() => {}} compact />
          : <ProgressBar position={player.position} duration={player.duration} disabled={!song || unavailable || player.media?.source !== 'local'} onSeek={player.seek} compact />}
      </div>
      <div className="player-right">
        <VolumeControl volume={player.volume} muted={player.muted} disabled={spotify} onVolume={(value) => { player.setVolume(value); player.setMuted(false); }} onMuted={() => player.setMuted(!player.muted)} />
        <button type="button" className={player.queueOpen ? 'is-active player-icon-button' : 'player-icon-button'} onClick={() => player.setQueueOpen(!player.queueOpen)} aria-label="Afficher la file d’attente"><ListMusic size={18} /></button>
        <button type="button" className="player-icon-button" onClick={() => player.setNowPlayingOpen(true)} disabled={!song} aria-label="Ouvrir en plein écran"><Expand size={18} /></button>
      </div>
    </footer>
  );
});
