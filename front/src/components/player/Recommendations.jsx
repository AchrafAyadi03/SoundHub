import { memo, useMemo } from 'react';
import { usePlayer } from '../../context/PlayerContext.jsx';
import { SongCover, formatArtists } from '../../components.jsx';

const RecommendationCard = memo(function RecommendationCard({ song, queue }) {
  const player = usePlayer();
  const title = song.track_name || song.title || 'Titre inconnu';
  const artists = formatArtists(song.artists || song.artist) || 'Artiste inconnu';

  return (
    <button
      className="recommendation-card"
      type="button"
      onClick={() => player.playSong(song, queue)}
      aria-label={`Lire ${title} par ${artists}`}
    >
      <SongCover song={song} size="sm" />
      <span className="recommendation-copy">
        <strong dir="auto" title={title}>{title}</strong>
        <span dir="auto" title={artists}>{artists}</span>
      </span>
    </button>
  );
});

export default function Recommendations({ song, queue }) {
  const picks = useMemo(() => {
    if (!song || !queue.length) return [];
    const currentId = song.song_id || song.id;
    const artist = String(song.artists || song.artist || '').split(';')[0].trim().toLocaleLowerCase();
    const remaining = queue.filter((item) => (item.song_id || item.id) !== currentId);
    const sameArtist = remaining.filter((item) => (
      String(item.artists || item.artist || '').split(';')[0].trim().toLocaleLowerCase() === artist
    ));
    return [...sameArtist, ...remaining.filter((item) => !sameArtist.includes(item))].slice(0, 3);
  }, [song, queue]);

  if (!picks.length) return null;

  return (
    <section className="player-recommendations" aria-labelledby="player-recommendations-heading">
      <div className="recommendations-heading">
        <div>
          <span className="player-section-kicker">À DÉCOUVRIR</span>
          <h3 id="player-recommendations-heading">À écouter ensuite</h3>
        </div>
        <span className="recommendations-artist" dir="auto">
          {String(song?.artists || song?.artist || '').split(';')[0].trim()}
        </span>
      </div>
      <div className="recommendations-list">
        {picks.map((item) => (
          <RecommendationCard key={item.song_id || item.id} song={item} queue={queue} />
        ))}
      </div>
    </section>
  );
}
