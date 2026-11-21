import { Play } from 'lucide-react';
import { SongCover, formatArtists } from '../components.jsx';

export default function MusicCard({
  song,
  onPlay,
  playLabel,
  title,
  subtitle,
  meta,
  badge,
  actions,
  className = '',
  featured = false,
}) {
  const displayTitle = title ?? song?.track_name ?? song?.title ?? song?.song_id ?? 'Titre inconnu';
  const displaySubtitle = subtitle ?? (formatArtists(song?.artists || song?.artist) || 'Artiste inconnu');
  const label = playLabel ?? `Écouter ${displayTitle}`;

  return (
    <article
      className={`group relative flex h-full min-w-0 flex-col rounded-2xl bg-[#111513] border border-white/[0.06] p-3 transition-all duration-300 ease-out hover:bg-[#181D1A] hover:border-emerald-300/25 hover:shadow-[0_0_50px_-12px_rgba(124,255,203,0.35)] hover:-translate-y-1 ${className}`}
    >
      <div className="relative mb-3 aspect-square w-full overflow-hidden rounded-xl bg-[#0A0C0B]">
        <div className="absolute inset-0 transition-transform duration-500 ease-out group-hover:scale-[1.08]">
          <SongCover song={song} fill className="!rounded-xl" />
        </div>

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        {badge != null && badge !== '' && (
          <span className="pointer-events-none absolute left-2 top-2 z-[1] flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold text-emerald-300 backdrop-blur-md font-mono tracking-wider">
            {badge === '01' && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
              </span>
            )}
            {badge}
          </span>
        )}

        {onPlay && (
          <button
            type="button"
            onClick={onPlay}
            aria-label={label}
            className="absolute bottom-2 right-2 z-[2] inline-flex h-11 w-11 translate-y-3 items-center justify-center rounded-full bg-emerald-300 text-[#0A1F16] opacity-0 shadow-[0_4px_24px_rgba(124,255,203,0.5)] transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-110 focus-visible:opacity-100 focus-visible:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60 active:scale-95 group-hover:translate-y-0 group-hover:opacity-100"
          >
            <Play size={18} fill="currentColor" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h3
          className={`truncate font-heading text-sm font-semibold ${featured ? 'text-gradient' : 'text-white'}`}
          title={displayTitle}
        >
          {displayTitle}
        </h3>
        <p className="mt-1 truncate text-sm text-gray-400" title={displaySubtitle}>
          {displaySubtitle}
        </p>
        {meta && <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 font-mono">{meta}</div>}
      </div>

      {actions && <div className="mt-3 flex items-center gap-2">{actions}</div>}
    </article>
  );
}