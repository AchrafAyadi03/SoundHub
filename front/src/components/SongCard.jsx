import { Play } from "lucide-react";
import "./SongCard.css";

export default function SongCard({ song, onPlay }) {

    return (
        <div className="song-card">

            <div className="song-cover">

                <img
                    src={song.cover}
                    alt={song.title}
                    loading="lazy"
                />

                <button
                    className="song-play"
                    onClick={onPlay}
                    aria-label={`Play ${song.title}`}
                >
                    <Play fill="currentColor" />
                </button>

            </div>

            <h3>{song.title}</h3>

            <p>{song.artist}</p>

            <small>
                {Math.floor(song.duration / 60)}:
                {String(song.duration % 60).padStart(2, "0")}
            </small>

        </div>
    );
}