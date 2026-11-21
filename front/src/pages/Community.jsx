/* =====================================================================
 * src/pages/Community.jsx : espace communauté
 * ---------------------------------------------------------------------
 * Cas d'utilisation :
 *   - INVITÉ     : lit le fil et les commentaires (lecture seule) ;
 *   - CONNECTÉ   : publie un texte libre ou partage une de ses playlists,
 *                  like, commente et supprime ses propres contenus.
 * Le React échappe automatiquement le texte affiché : pas de risque XSS
 * tant qu'on n'utilise jamais dangerouslySetInnerHTML.
 * ===================================================================== */
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { http as api } from '../api';



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
          ? <p>Aucune playlist publique ou non listée. Rendez-en une partageable dans <Link to="/playlists">Mes playlists</Link>.</p>
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
 * PostCard : un post avec like, commentaires et suppression.
 * Cas d'utilisation : un invité qui tente d'agir est envoyé vers /login.
 * ------------------------------------------------------------------- */
function PostCard({ post, user, onChange, onDeleted }) {
  const navigate = useNavigate();
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState(null); // null = pas encore chargés
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  // Les actions d'écriture exigent un compte.
  const needLogin = () => {
    if (user) return false;
    navigate('/login', { state: { from: { pathname: '/community' } } });
    return true;
  };

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
    if (next && comments === null) {
      try {
        const full = await api(`/community/posts/${post.id}`);
        setComments(full.comments);
      } catch (e) { setError(e.message); }
    }
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
      <header>
        <strong>{post.author.username}</strong>
        <time dateTime={post.createdAt}> · {new Date(post.createdAt).toLocaleString('fr-FR')}</time>
        {post.isMine && <button onClick={removePost}>Supprimer</button>}
      </header>

      {post.content && <p className="post-content">{post.content}</p>}

      {post.playlist && (
        <div className="post-playlist">
          🎵 <strong>{post.playlist.title}</strong> · {post.playlist.tracksCount} morceau(x)
          {post.playlist.description && <p>{post.playlist.description}</p>}
        </div>
      )}

      <footer>
        <button onClick={toggleLike} aria-pressed={post.likedByMe}>
          {post.likedByMe ? '❤️' : '🤍'} {post.likesCount}
        </button>
        <button onClick={toggleComments}>💬 {post.commentsCount}</button>
      </footer>

      {error && <p className="form-error" role="alert">{error}</p>}

      {showComments && (
        <section className="comments">
          {comments === null && <p>Chargement…</p>}
          {comments?.map((c) => (
            <div key={c.id} className="comment">
              <strong>{c.author.username}</strong> {c.content}
              {user && (c.author.id === user.id || post.isMine) && (
                <button onClick={() => removeComment(c.id)} aria-label="Supprimer le commentaire">✕</button>
              )}
            </div>
          ))}
          {user ? (
            <form onSubmit={addComment}>
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Écrire un commentaire…" maxLength={1000} />
              <button type="submit" disabled={!text.trim()}>Envoyer</button>
            </form>
          ) : (
            <p><Link to="/login">Connectez-vous</Link> pour commenter.</p>
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
        : <p>Vous êtes en mode invité. <Link to="/login">Connectez-vous</Link> pour publier, liker et commenter.</p>}

      {error && <p className="form-error" role="alert">{error}</p>}
      {posts.map((p) => (
        <PostCard key={p.id} post={p} user={user} onChange={updatePost} onDeleted={removePost} />
      ))}
      {!loading && posts.length === 0 && <p>Aucune publication pour le moment.</p>}
      {loading && <p>Chargement…</p>}
      {!loading && posts.length < total && <button onClick={() => load(page + 1)}>Voir plus</button>}
    </main>
  );
}