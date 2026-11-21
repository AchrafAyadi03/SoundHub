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

  const secondaryButtonClass = (active = false) =>
    `inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-300 transition-all duration-200 ease-in-out hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${active ? 'bg-white/10 text-accent' : ''}`;

  return (
    <footer
      className="player-bar border-t border-white/10 bg-black/60 backdrop-blur-xl"
      aria-label="Lecteur de musique"
    >
      <button
        type="button"
        className="player-track group flex min-w-0 items-center gap-3 text-left transition-all duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-95"
        onClick={() => player.setNowPlayingOpen(true)}
        aria-label="Ouvrir la vue en cours de lecture"
      >
        {song ? <SongCover song={song} size="sm" /> : <span className="player-cover-empty inline-flex h-10 w-10 items-center justify-center rounded-md bg-white/5 text-gray-400"><Play size={17} /></span>}
        <span className="player-track-meta min-w-0">
          <strong className="block truncate text-sm font-medium text-white">{song?.track_name || song?.title || 'Aucune lecture en cours'}</strong>
          <span className="block truncate text-xs text-gray-400">{formatArtists(song?.artists || song?.artist) || 'Choisissez un titre'}</span>
        </span>
      </button>

      <div className="player-center flex min-w-0 flex-col items-center gap-1">
        <div className="player-controls flex items-center justify-center gap-2">
          <button type="button" className={secondaryButtonClass(false)} onClick={player.previous} disabled={!song} aria-label="Titre précédent"><SkipBack size={17} /></button>
          <button type="button" className={secondaryButtonClass(player.shuffle)} onClick={() => player.setShuffle(!player.shuffle)} aria-label="Activer ou désactiver la lecture aléatoire"><Shuffle size={16} /></button>
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-accent text-[#0F0F0F] shadow-lg shadow-emerald-500/30 transition-all duration-200 ease-in-out hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={player.togglePlay}
            disabled={!song || unavailable}
            aria-label={player.playing ? 'Mettre en pause' : 'Lire'}
          >
            {player.playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
          <button type="button" className={secondaryButtonClass(false)} onClick={player.next} disabled={!song} aria-label="Titre suivant"><SkipForward size={17} /></button>
          <button type="button" className={secondaryButtonClass(player.repeat !== 'none')} onClick={player.cycleRepeat} aria-label={`Répétition : ${player.repeat}`}>{repeatIcon}</button>
        </div>
        <div className="w-full max-w-xl">
          {spotify
            ? spotifyProgressAvailable && <ProgressBar position={player.spotifyPosition} duration={player.spotifyDuration} onSeek={player.seekSpotify} compact />
            : <ProgressBar position={player.position} duration={player.duration} disabled={!song || unavailable || player.media?.source !== 'local'} onSeek={player.seek} compact />}
        </div>
      </div>

      <div className="player-right flex items-center justify-end gap-2">
        <VolumeControl
          volume={player.volume}
          muted={player.muted}
          disabled={spotify}
          disabledReason={spotify ? 'Le volume Spotify se règle dans le lecteur Spotify.' : undefined}
          onVolume={(value) => { player.setVolume(value); player.setMuted(false); }}
          onMuted={() => player.setMuted(!player.muted)}
        />
        <button type="button" className={secondaryButtonClass(player.queueOpen)} onClick={() => player.setQueueOpen(!player.queueOpen)} aria-label="Afficher la file d’attente"><ListMusic size={18} /></button>
        <button type="button" className={secondaryButtonClass(false)} onClick={() => player.setNowPlayingOpen(true)} disabled={!song} aria-label="Ouvrir en plein écran"><Expand size={18} /></button>
      </div>
    </footer>
  );
});
