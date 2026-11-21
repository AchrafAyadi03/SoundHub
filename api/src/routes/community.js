/* =====================================================================
 * routes/community.js : espace communauté (posts, likes, commentaires)
 * ---------------------------------------------------------------------
 * Montage dans server.js : app.use('/api/community', require('./src/routes/community'));
 *
 * Règles d'accès :
 *   - INVITÉ     : peut lire le fil et les commentaires (lecture seule).
 *   - CONNECTÉ   : peut publier (texte libre ou playlist), liker, commenter,
 *                  et supprimer ses propres contenus.
 *   - ADMIN      : peut supprimer n'importe quel post ou commentaire (modération).
 * ===================================================================== */
const router = require('express').Router();
const mongoose = require('mongoose');
const Post = require('../models/Post');
const Playlist = require('../models/Playlist');
const redis = require('../config/redis');
const { auth, optionalAuth } = require('../middleware/auth');

/* ---------------------------------------------------------------------
 * UTILITAIRES
 * Cas d'utilisation : validations et mise en forme réutilisées par les routes.
 * ------------------------------------------------------------------- */
const POST_TYPES = ['text', 'playlist'];
const MAX_POST = 2000;
const MAX_COMMENT = 1000;
const isId = (id) => mongoose.isValidObjectId(id);
const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const clean = (v) => String(v == null ? '' : v).trim();

/* Anti-spam : 20 publications par heure et par utilisateur (compteur Redis).
 * Cas d'utilisation : empêcher qu'un compte inonde la communauté. */
async function postLimiter(req, res, next) {
  try {
    const key = `postlimit:${req.user.sub}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 60 * 60);
    if (count > 20) return res.status(429).json({ error: 'Trop de publications, réessayez plus tard' });
    next();
  } catch (err) {
    next(err);
  }
}

/* Met en forme un post pour le front.
 * Cas d'utilisation : ne renvoyer que des compteurs (pas la liste des likes),
 * savoir si le visiteur a déjà liké, et masquer une playlist redevenue privée. */
function formatPost(p, viewer, withComments = false) {
  const viewerId = viewer ? viewer.sub : null;
  const pl = p.playlist && p.playlist.visibility !== 'private' ? p.playlist : null;
  const out = {
    id: p._id,
    type: p.type,
    content: p.content || '',
    author: p.author
      ? { id: String(p.author._id), username: p.author.username, avatarUrl: p.author.avatarUrl || null }
      : { id: null, username: 'Utilisateur supprimé', avatarUrl: null },
    playlist: pl
      ? { id: pl._id, title: pl.title, description: pl.description || '', tracksCount: pl.tracks.length }
      : null,
    likesCount: p.likes.length,
    likedByMe: viewerId ? p.likes.some((l) => String(l) === viewerId) : false,
    commentsCount: p.comments.length,
    isMine: !!viewerId && !!p.author && String(p.author._id) === viewerId,
    createdAt: p.createdAt,
  };
  if (withComments) {
    out.comments = p.comments.map((c) => ({
      id: c._id,
      content: c.content,
      author: c.author
        ? { id: String(c.author._id), username: c.author.username, avatarUrl: c.author.avatarUrl || null }
        : { id: null, username: 'Utilisateur supprimé', avatarUrl: null },
      createdAt: c.createdAt,
    }));
  }
  return out;
}

/* ---------------------------------------------------------------------
 * 1. FIL DE LA COMMUNAUTÉ (invité autorisé)
 * Cas d'utilisation : page « Communauté » : posts récents avec likes et
 * compteurs de commentaires. Filtres optionnels : type et auteur.
 * GET /api/community?page=1&limit=20&type=playlist&author=<userId>
 * ------------------------------------------------------------------- */
router.get('/', optionalAuth, asyncH(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);

  const filter = {};
  if (req.query.type) {
    if (!POST_TYPES.includes(req.query.type)) return res.status(400).json({ error: 'type invalide' });
    filter.type = req.query.type;
  }
  if (req.query.author) {
    if (!isId(req.query.author)) return res.status(400).json({ error: 'author invalide' });
    filter.author = req.query.author;
  }

  const [items, total] = await Promise.all([
    Post.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('author', 'username avatarUrl')
      .populate('playlist', 'title description visibility tracks')
      .lean(),
    Post.countDocuments(filter),
  ]);
  res.json({ page, limit, total, items: items.map((p) => formatPost(p, req.user)) });
}));

/* ---------------------------------------------------------------------
 * 2. PUBLIER UN POST (connecté)
 * Cas d'utilisation : « partager sa vie » (type text) ou partager une de
 * ses playlists (type playlist, avec un texte d'accompagnement facultatif).
 * Une playlist privée ne peut pas être publiée : il faut d'abord la
 * rendre publique ou non listée.
 * POST /api/community/posts   { type, content?, playlistId? }
 * ------------------------------------------------------------------- */
router.post('/posts', auth, postLimiter, asyncH(async (req, res) => {
  const type = req.body.type || 'text';
  const content = clean(req.body.content);

  if (!POST_TYPES.includes(type)) return res.status(400).json({ error: 'type invalide (text ou playlist)' });
  if (content.length > MAX_POST) return res.status(400).json({ error: `Texte trop long (${MAX_POST} max)` });

  let playlist = null;
  if (type === 'text') {
    if (!content) return res.status(400).json({ error: 'Le texte du post est requis' });
  } else {
    if (!isId(req.body.playlistId)) return res.status(400).json({ error: 'playlistId requis' });
    const pl = await Playlist.findById(req.body.playlistId);
    if (!pl) return res.status(404).json({ error: 'Playlist introuvable' });
    if (String(pl.owner) !== req.user.sub) {
      return res.status(403).json({ error: 'Vous ne pouvez partager que vos propres playlists' });
    }
    if (pl.visibility === 'private') {
      return res.status(400).json({ error: 'Rendez la playlist publique ou non listée avant de la partager' });
    }
    playlist = pl._id;
  }

  const post = await Post.create({ author: req.user.sub, type, content, playlist });
  const full = await Post.findById(post._id)
    .populate('author', 'username avatarUrl')
    .populate('playlist', 'title description visibility tracks')
    .lean();
  res.status(201).json(formatPost(full, req.user));
}));

/* ---------------------------------------------------------------------
 * 3. DÉTAIL D'UN POST AVEC SES COMMENTAIRES (invité autorisé)
 * Cas d'utilisation : ouvrir un post et lire la discussion.
 * GET /api/community/posts/:id
 * ------------------------------------------------------------------- */
router.get('/posts/:id', optionalAuth, asyncH(async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ error: 'Identifiant invalide' });
  const post = await Post.findById(req.params.id)
    .populate('author', 'username avatarUrl')
    .populate('playlist', 'title description visibility tracks')
    .populate('comments.author', 'username avatarUrl')
    .lean();
  if (!post) return res.status(404).json({ error: 'Post introuvable' });
  res.json(formatPost(post, req.user, true));
}));

/* ---------------------------------------------------------------------
 * 4. SUPPRIMER UN POST (auteur ou admin)
 * Cas d'utilisation : retirer sa publication, ou modération par un admin.
 * DELETE /api/community/posts/:id
 * ------------------------------------------------------------------- */
router.delete('/posts/:id', auth, asyncH(async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ error: 'Identifiant invalide' });
  const post = await Post.findById(req.params.id).select('author');
  if (!post) return res.status(404).json({ error: 'Post introuvable' });

  const isAuthor = String(post.author) === req.user.sub;
  if (!isAuthor && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Vous ne pouvez pas supprimer ce post' });
  }
  await post.deleteOne();
  res.json({ message: 'Post supprimé' });
}));

/* ---------------------------------------------------------------------
 * 5. LIKER / RETIRER SON LIKE (connecté)
 * Cas d'utilisation : bouton cœur. Un même utilisateur ne peut liker
 * qu'une fois ; un second appel retire le like (bascule).
 * POST /api/community/posts/:id/like
 * ------------------------------------------------------------------- */
router.post('/posts/:id/like', auth, asyncH(async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ error: 'Identifiant invalide' });
  const post = await Post.findById(req.params.id).select('likes');
  if (!post) return res.status(404).json({ error: 'Post introuvable' });

  const uid = req.user.sub;
  const alreadyLiked = post.likes.some((l) => String(l) === uid);
  await Post.updateOne(
    { _id: post._id },
    alreadyLiked ? { $pull: { likes: uid } } : { $addToSet: { likes: uid } }
  );
  res.json({ liked: !alreadyLiked, likesCount: post.likes.length + (alreadyLiked ? -1 : 1) });
}));

/* ---------------------------------------------------------------------
 * 6. COMMENTER UN POST (connecté)
 * Cas d'utilisation : répondre à une publication de la communauté.
 * POST /api/community/posts/:id/comments   { content }
 * ------------------------------------------------------------------- */
router.post('/posts/:id/comments', auth, postLimiter, asyncH(async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ error: 'Identifiant invalide' });
  const content = clean(req.body.content);
  if (!content) return res.status(400).json({ error: 'Le commentaire est vide' });
  if (content.length > MAX_COMMENT) return res.status(400).json({ error: `Commentaire trop long (${MAX_COMMENT} max)` });

  const post = await Post.findByIdAndUpdate(
    req.params.id,
    { $push: { comments: { author: req.user.sub, content, createdAt: new Date() } } },
    { new: true }
  ).populate('comments.author', 'username avatarUrl');
  if (!post) return res.status(404).json({ error: 'Post introuvable' });

  const c = post.comments[post.comments.length - 1];
  res.status(201).json({
    id: c._id,
    content: c.content,
    author: { id: String(c.author._id), username: c.author.username, avatarUrl: c.author.avatarUrl || null },
    createdAt: c.createdAt,
    commentsCount: post.comments.length,
  });
}));

/* ---------------------------------------------------------------------
 * 7. SUPPRIMER UN COMMENTAIRE (auteur du commentaire, auteur du post ou admin)
 * Cas d'utilisation : retirer son commentaire, ou modérer sa propre
 * publication, ou modération par un admin.
 * DELETE /api/community/posts/:id/comments/:commentId
 * ------------------------------------------------------------------- */
router.delete('/posts/:id/comments/:commentId', auth, asyncH(async (req, res) => {
  if (!isId(req.params.id) || !isId(req.params.commentId)) {
    return res.status(400).json({ error: 'Identifiant invalide' });
  }
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post introuvable' });

  const comment = post.comments.id(req.params.commentId);
  if (!comment) return res.status(404).json({ error: 'Commentaire introuvable' });

  const uid = req.user.sub;
  const allowed =
    String(comment.author) === uid || String(post.author) === uid || req.user.role === 'admin';
  if (!allowed) return res.status(403).json({ error: 'Vous ne pouvez pas supprimer ce commentaire' });

  post.comments.pull(comment._id);
  await post.save();
  res.json({ message: 'Commentaire supprimé', commentsCount: post.comments.length });
}));

module.exports = router;