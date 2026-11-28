/* =====================================================================
 * src/pages/Community.jsx : espace communauté
 * ---------------------------------------------------------------------
 * Cas d'utilisation :
 *   - INVITÉ     : lit le fil, écoute les playlists partagées et lit les
 *                  commentaires (lecture seule) ;
 *   - CONNECTÉ   : publie un texte libre ou partage une de ses playlists,
 *                  like, commente et supprime ses propres contenus.
 * Les playlists partagées s'affichent dans un style inspiré de Spotify :
 * pochette en mosaïque, bouton lecture, liste de morceaux dépliable.
 * Les infos des morceaux (titre, artiste, pochette...) viennent directement
 * du serveur : plus besoin de charger le catalogue côté React.
 * Le React échappe automatiquement le texte affiché : pas de risque XSS
 * tant qu'on n'utilise jamais dangerouslySetInnerHTML.
 * ===================================================================== */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, Heart, ListMusic, MessageCircle, Pause, Play, Trash2 } from 'lucide-react';
import { http as api } from '../api';
import { SongCover, formatArtists, formatDuration } from '../components.jsx';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';
import '../styles/community.css';

/* ---------------------------------------------------------------------
 * UTILITAIRES
 * Cas d'utilisation : petites fonctions partagées par les composants.
 * ------------------------------------------------------------------- */
const songKey = (song) => String(song.song_id || song.id);
const songTitle = (song) => song.track_name || song.title || 'Titre inconnu';

// Teinte (0-359) stable calculée depuis l'id : chaque playlist a sa couleur d'ambiance.
function hueFrom(text) {
  let h = 0;
  for (const c of String(text)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

// Durée d'un morceau en millisecondes. Le catalogue peut la nommer duration_ms
// ou track_duration_ms selon le fichier CSV d'origine : on accepte les deux.
const songMs = (song) => Number(song.duration_ms || song.track_duration_ms) || 0;

// Durée totale lisible : « 42 min » ou « 1 h 05 ».
function totalDuration(songs) {
  const minutes = Math.round(songs.reduce((t, s) => t + songMs(s), 0) / 60000);
  if (!minutes) return '';
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}` : `${minutes} min`;
}

// Extrait les morceaux résolus par le serveur (ceux absents du catalogue sont ignorés).
const songsOf = (tracks) => (tracks || []).map((t) => t.song).filter(Boolean);

/* ---------------------------------------------------------------------
 * SharedPlaylist : carte de playlist façon Spotify.
 * Cas d'utilisation : écouter directement une playlist partagée dans le
 * fil, et déplier ses morceaux (clic ou double-clic pour lancer un titre).
 * ------------------------------------------------------------------- */
function SharedPlaylist({ post, detail, ensureDetail }) {
  const player = usePlayer();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const pl = post.playlist;

  // Morceaux d'aperçu (4 premiers, fournis par le fil) et liste complète (chargée au besoin).
  const previewSongs = songsOf(pl.previewTracks);
  const tracks = useMemo(() => songsOf(detail?.playlist?.tracks), [detail]);
  const knownSongs = tracks.length ? tracks : previewSongs;

  // Le morceau en cours appartient-il à cette playlist ?
  const currentId = player.current ? songKey(player.current) : null;
  const isCurrent = !!currentId && knownSongs.some((s) => songKey(s) === currentId);

  // Bouton lecture : lance toute la playlist, ou met en pause si elle joue déjà.
  async function playAll() {
    if (isCurrent && player.playing) return player.togglePlay();
    setBusy(true);
    try {
      const full = detail || (await ensureDetail());
      const queue = songsOf(full?.playlist?.tracks);
      if (queue[0]) player.playSong(queue[0], queue);
    } finally {
      setBusy(false);
    }
  }

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) await ensureDetail();
  }

  const duration = totalDuration(knownSongs);

  return (
    <section className="sp-playlist" style={{ '--hue': hueFrom(pl.id) }}>
      <div className="sp-hero">
        {/* Pochette : mosaïque de 4 pochettes, ou pochette unique s'il y en a moins */}
        <div className="sp-cover" aria-hidden="true">
          {previewSongs.length >= 4 ? (
            <div className="sp-cover-grid">
              {previewSongs.slice(0, 4).map((s) => (
                <div className="sp-cover-cell" key={songKey(s)}><SongCover song={s} size="sm" /></div>
              ))}
            </div>
          ) : previewSongs.length ? (
            <div className="sp-cover-cell"><SongCover song={previewSongs[0]} size="sm" /></div>
          ) : (
            <ListMusic size={40} />
          )}
        </div>

        <div className="sp-hero-info">
          <span className="sp-kind">Playlist</span>
          <h3>{pl.title}</h3>
          {pl.description && <p className="sp-desc">{pl.description}</p>}
          <p className="sp-meta">
            <strong>{post.author.username}</strong> · {pl.tracksCount} morceau{pl.tracksCount > 1 ? 'x' : ''}
            {duration && <> · {duration}</>}
          </p>
        </div>
      </div>

      <div className="sp-actions">
        <button
          type="button"
          className="sp-play"
          onClick={playAll}
          disabled={busy || pl.tracksCount === 0}
          aria-label={isCurrent && player.playing ? `Mettre en pause ${pl.title}` : `Lire ${pl.title}`}
        >
          {isCurrent && player.playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
        </button>
        <button type="button" className="sp-toggle" onClick={toggleOpen} aria-expanded={open}>
          {open ? 'Masquer les morceaux' : 'Voir les morceaux'}
          <ChevronDown size={16} className={open ? 'is-flipped' : ''} />
        </button>
      </div>

      {open && (
        <div className="sp-tracklist">
          <div className="sp-track sp-track-head">
            <span className="sp-track-index">#</span>
            <span>Titre</span>
            <span className="sp-col-album">Album</span>
            <span className="sp-col-dur">Durée</span>
          </div>

          {detail === null && <p className="sp-muted">Chargement…</p>}
          {detail && tracks.length === 0 && (
            <p className="sp-muted">
              {pl.tracksCount ? 'Ces morceaux ne sont plus disponibles dans le catalogue.' : 'Cette playlist est vide.'}
            </p>
          )}

          {tracks.map((song, index) => {
            const active = currentId === songKey(song);
            return (
              <div
                key={songKey(song)}
                className={`sp-track ${active ? 'is-active' : ''}`}
                onDoubleClick={() => player.playSong(song, tracks)}
              >
                <button
                  type="button"
                  className="sp-track-index"
                  onClick={() => (active && player.playing ? player.togglePlay() : player.playSong(song, tracks))}
                  aria-label={`${active && player.playing ? 'Mettre en pause' : 'Lire'} ${songTitle(song)}`}
                >
                  {/* Pendant la lecture : égaliseur animé ; sinon : numéro de piste */}
                  {active && player.playing
                    ? <span className="sp-eq" aria-hidden="true"><i /><i /><i /><i /></span>
                    : <span className="sp-num">{index + 1}</span>}
                  {/* Icône affichée au survol de la ligne */}
                  <span className="sp-icon">
                    {active && player.playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                  </span>
                </button>
                <div className="sp-track-main">
                  <SongCover song={song} size="sm" />
                  <div>
                    <strong>{songTitle(song)}</strong>
                    <span>{formatArtists(song.artists || song.artist)}</span>
                  </div>
                </div>
                <span className="sp-col-album">{song.album_name || song.album || '—'}</span>
                <span className="sp-col-dur">{formatDuration(songMs(song))}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------------
 * Composer : formulaire de publication (visible uniquement si connecté).
 * Cas d'utilisation : « partager sa vie » (texte) ou partager une playlist.
 * ------------------------------------------------------------------- */
function Composer({ onPublished }) {
  const [type, setType] = useState('text');
  const [content, setContent] = useState('');
  const [playlists, setPlaylists] = useState([]);
  const [playlistId, setPlaylistId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Charge les playlists partageables (les privées sont refusées par le serveur).
  useEffect(() => {
    if (type !== 'playlist') return;
    api('/playlists/mine')
      .then((list) => {
        const shareable = list.filter((p) => p.visibility !== 'private');
        setPlaylists(shareable);
        setPlaylistId(shareable[0]?.id || '');
      })
      .catch((e) => setError(e.message));
  }, [type]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const body = type === 'text' ? { type, content } : { type, content, playlistId };
      const post = await api('/community/posts', { method: 'POST', body });
      setContent('');
      onPublished(post);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="composer" onSubmit={submit}>
      <select value={type} onChange={(e) => setType(e.target.value)}>
        <option value="text">Partager un moment</option>
        <option value="playlist">Partager une playlist</option>
      </select>

      {type === 'playlist' && (
        playlists.length === 0
          ? <p className="sp-muted">Aucune playlist publique ou non listée. Rendez-en une partageable dans <Link to="/playlists">Mes playlists</Link>.</p>
          : (
            <select value={playlistId} onChange={(e) => setPlaylistId(e.target.value)}>
              {playlists.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          )
      )}

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={type === 'text' ? 'Quoi de neuf ?' : 'Un mot sur cette playlist (facultatif)'}
        maxLength={2000}
        rows={3}
      />
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit" disabled={busy || (type === 'text' ? !content.trim() : !playlistId)}>Publier</button>
    </form>
  );
}

/* ---------------------------------------------------------------------
 * PostCard : un post avec playlist, like, commentaires et suppression.
 * Cas d'utilisation : un invité qui tente d'agir est envoyé vers /login.
 * Le détail du post (morceaux + commentaires) est chargé une seule fois,
 * au premier dépliage, et partagé entre la playlist et les commentaires.
 * ------------------------------------------------------------------- */
function PostCard({ post, user, onChange, onDeleted }) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);       // null = pas encore chargé
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState(null);   // null = pas encore chargés
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  // Les actions d'écriture exigent un compte.
  const needLogin = () => {
    if (user) return false;
    navigate('/login', { state: { from: { pathname: '/community' } } });
    return true;
  };

  // Charge (une fois) le détail du post : liste complète des morceaux et commentaires.
  const ensureDetail = useCallback(async () => {
    if (detail) return detail;
    try {
      const full = await api(`/community/posts/${post.id}`);
      setDetail(full);
      setComments((prev) => prev ?? full.comments);
      return full;
    } catch (e) {
      setError(e.message);
      return null;
    }
  }, [detail, post.id]);

  async function toggleLike() {
    if (needLogin()) return;
    try {
      const r = await api(`/community/posts/${post.id}/like`, { method: 'POST' });
      onChange({ ...post, likedByMe: r.liked, likesCount: r.likesCount });
    } catch (e) { setError(e.message); }
  }

  async function toggleComments() {
    const next = !showComments;
    setShowComments(next);
    if (next && comments === null) await ensureDetail();
  }

  async function addComment(e) {
    e.preventDefault();
    if (needLogin() || !text.trim()) return;
    try {
      const c = await api(`/community/posts/${post.id}/comments`, { method: 'POST', body: { content: text } });
      setComments([...(comments || []), c]);
      setText('');
      onChange({ ...post, commentsCount: c.commentsCount });
    } catch (err) { setError(err.message); }
  }

  async function removeComment(id) {
    try {
      const r = await api(`/community/posts/${post.id}/comments/${id}`, { method: 'DELETE' });
      setComments(comments.filter((c) => c.id !== id));
      onChange({ ...post, commentsCount: r.commentsCount });
    } catch (err) { setError(err.message); }
  }

  async function removePost() {
    if (!window.confirm('Supprimer ce post ?')) return;
    try {
      await api(`/community/posts/${post.id}`, { method: 'DELETE' });
      onDeleted(post.id);
    } catch (err) { setError(err.message); }
  }

  return (
    <article className="post">
      <header className="post-header">
        <span className="avatar" aria-hidden="true">{post.author.username?.[0]?.toUpperCase() || '?'}</span>
        <div className="post-author">
          <strong>{post.author.username}</strong>
          <time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleString('fr-FR')}</time>
        </div>
        {post.isMine && (
          <button type="button" className="icon-button" onClick={removePost} aria-label="Supprimer ce post">
            <Trash2 size={16} />
          </button>
        )}
      </header>

      {post.content && <p className="post-content">{post.content}</p>}

      {/* Playlist partagée (ou message si elle n'est plus partagée) */}
      {post.type === 'playlist' && (
        post.playlist
          ? <SharedPlaylist post={post} detail={detail} ensureDetail={ensureDetail} />
          : <p className="sp-muted">Cette playlist n'est plus partagée.</p>
      )}

      <footer className="post-footer">
        <button type="button" className={`post-action ${post.likedByMe ? 'is-liked' : ''}`} onClick={toggleLike} aria-pressed={post.likedByMe}>
          <Heart size={18} fill={post.likedByMe ? 'currentColor' : 'none'} /> {post.likesCount}
        </button>
        <button type="button" className="post-action" onClick={toggleComments} aria-expanded={showComments}>
          <MessageCircle size={18} /> {post.commentsCount}
        </button>
      </footer>

      {error && <p className="form-error" role="alert">{error}</p>}

      {showComments && (
        <section className="comments">
          {comments === null && <p className="sp-muted">Chargement…</p>}
          {comments?.map((c) => (
            <div key={c.id} className="comment">
              <span><strong>{c.author.username}</strong> {c.content}</span>
              {user && (c.author.id === user.id || post.isMine) && (
                <button type="button" className="icon-button" onClick={() => removeComment(c.id)} aria-label="Supprimer le commentaire">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          {user ? (
            <form onSubmit={addComment} className="comment-form">
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Écrire un commentaire…" maxLength={1000} />
              <button type="submit" disabled={!text.trim()}>Envoyer</button>
            </form>
          ) : (
            <p className="sp-muted"><Link to="/login">Connectez-vous</Link> pour commenter.</p>
          )}
        </section>
      )}
    </article>
  );
}

/* ---------------------------------------------------------------------
 * Community : la page complète (fil + pagination).
 * ------------------------------------------------------------------- */
export default function Community() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const LIMIT = 20;

  const load = useCallback(async (pageToLoad) => {
    setLoading(true);
    try {
      const data = await api(`/community?page=${pageToLoad}&limit=${LIMIT}`);
      setPosts((prev) => (pageToLoad === 1 ? data.items : [...prev, ...data.items]));
      setTotal(data.total);
      setPage(pageToLoad);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Recharge le fil quand l'état de connexion change (pour mettre à jour « likedByMe »).
  useEffect(() => { load(1); }, [load, user?.id]);

  const updatePost = (updated) => setPosts((list) => list.map((p) => (p.id === updated.id ? updated : p)));
  const removePost = (id) => setPosts((list) => list.filter((p) => p.id !== id));

  return (
    <main className="community">
      <h1>Communauté</h1>

      {user
        ? <Composer onPublished={(post) => setPosts((list) => [post, ...list])} />
        : <p className="sp-muted">Vous êtes en mode invité. <Link to="/login">Connectez-vous</Link> pour publier, liker et commenter.</p>}

      {error && <p className="form-error" role="alert">{error}</p>}
      {posts.map((p) => (
        <PostCard key={p.id} post={p} user={user} onChange={updatePost} onDeleted={removePost} />
      ))}
      {!loading && posts.length === 0 && <p className="sp-muted">Aucune publication pour le moment.</p>}
      {loading && <p className="sp-muted">Chargement…</p>}
      {!loading && posts.length < total && <button type="button" className="load-more" onClick={() => load(page + 1)}>Voir plus</button>}
    </main>
  );
}