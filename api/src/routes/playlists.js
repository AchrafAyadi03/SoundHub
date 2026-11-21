/* =====================================================================
 * routes/playlists.js : gestion des playlists et du partage
 * ---------------------------------------------------------------------
 * Montage dans server.js : app.use('/api/playlists', require('./src/routes/playlists'));
 *
 * Règles d'accès :
 *   - INVITÉ     : peut lire les playlists publiques et ouvrir un lien partagé.
 *   - CONNECTÉ   : peut créer des playlists, modifier/supprimer les siennes,
 *                  gérer leurs morceaux et générer un lien de partage.
 *   - ADMIN      : peut en plus supprimer n'importe quelle playlist (modération).
 * ===================================================================== */
const router = require('express').Router();
let songResolver = () => null;
const createPlaylistRouter = (getSongById) => {
  if (typeof getSongById === 'function') songResolver = getSongById;
  return router;
};
const crypto = require('crypto');
const mongoose = require('mongoose');
const Playlist = require('../models/Playlist');
const Post = require('../models/Post');
const { auth, optionalAuth } = require('../middleware/auth');

/* ---------------------------------------------------------------------
 * UTILITAIRES
 * Cas d'utilisation : validations et conversions réutilisées par les routes.
 * ------------------------------------------------------------------- */
const VISIBILITIES = ['private', 'unlisted', 'public'];
const isId = (id) => mongoose.isValidObjectId(id);
const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const clean = (v) => String(v == null ? '' : v).trim();
// Échappe les caractères spéciaux pour utiliser un texte saisi dans une recherche regex.
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* Met en forme une playlist pour le front.
 * Cas d'utilisation : ne jamais exposer le shareToken à quelqu'un d'autre
 * que le propriétaire, et trier les morceaux par position. */
function format(p, viewer, withTracks = false, getSongById = () => null) {
  const ownerId = String(p.owner?._id || p.owner);
  const mine = !!viewer && viewer.sub === ownerId;
  const out = {
    id: p._id,
    title: p.title,
    description: p.description || '',
    visibility: p.visibility,
    owner: p.owner?.username
      ? { id: ownerId, username: p.owner.username, avatarUrl: p.owner.avatarUrl || null }
      : { id: ownerId },
    tracksCount: p.tracks.length,
    isMine: mine,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
  if (mine && p.shareToken) out.shareToken = p.shareToken;
  if (withTracks) {
    out.tracks = [...p.tracks]
      .sort((a, b) => a.position - b.position)
      .map((t) => ({
        trackId: t.trackId,
        position: t.position,
        addedAt: t.addedAt,
        song: getSongById(t.trackId) || null,
      }));
  }
  return out;
}

/* Charge une playlist et vérifie les droits de modification.
 * Cas d'utilisation : toute route qui modifie une playlist passe par ici.
 * Renvoie null (après avoir répondu 400/404/403) si l'accès est refusé. */
async function loadOwned(req, res, { allowAdmin = false } = {}) {
  if (!isId(req.params.id)) {
    res.status(400).json({ error: 'Identifiant invalide' });
    return null;
  }
  const pl = await Playlist.findById(req.params.id);
  if (!pl) {
    res.status(404).json({ error: 'Playlist introuvable' });
    return null;
  }
  const isOwner = String(pl.owner) === req.user.sub;
  const isAdmin = allowAdmin && req.user.role === 'admin';
  if (!isOwner && !isAdmin) {
    res.status(403).json({ error: 'Cette playlist ne vous appartient pas' });
    return null;
  }
  return pl;
}

/* ---------------------------------------------------------------------
 * 1. PLAYLISTS PUBLIQUES (invité autorisé)
 * Cas d'utilisation : page « Découvrir » avec recherche et pagination.
 * GET /api/playlists/public?q=texte&page=1&limit=20
 * ------------------------------------------------------------------- */
router.get('/public', optionalAuth, asyncH(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
  const q = clean(req.query.q);

  const filter = { visibility: 'public' };
  if (q) filter.title = { $regex: escapeRegex(q), $options: 'i' };

  const [items, total] = await Promise.all([
    Playlist.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('owner', 'username avatarUrl')
      .lean(),
    Playlist.countDocuments(filter),
  ]);
  res.json({ page, limit, total, items: items.map((p) => format(p, req.user)) });
}));

/* ---------------------------------------------------------------------
 * 2. MES PLAYLISTS (connecté)
 * Cas d'utilisation : page « Ma bibliothèque » (privées, non listées
 * et publiques de l'utilisateur).
 * GET /api/playlists/mine
 * ------------------------------------------------------------------- */
router.get('/mine', auth, asyncH(async (req, res) => {
  const items = await Playlist.find({ owner: req.user.sub }).sort({ updatedAt: -1 }).lean();
  res.json(items.map((p) => format(p, req.user)));
}));

/* ---------------------------------------------------------------------
 * 3. OUVRIR UN LIEN PARTAGÉ (invité autorisé)
 * Cas d'utilisation : quelqu'un reçoit un lien de partage et consulte la
 * playlist, même sans compte. Fonctionne pour les playlists non listées
 * et publiques ; une playlist redevenue privée n'est plus accessible.
 * GET /api/playlists/shared/:token
 * ------------------------------------------------------------------- */
router.get('/shared/:token', optionalAuth, asyncH(async (req, res) => {
  const pl = await Playlist.findOne({
    shareToken: clean(req.params.token),
    visibility: { $in: ['unlisted', 'public'] },
  })
    .populate('owner', 'username avatarUrl')
    .lean();
  if (!pl) return res.status(404).json({ error: 'Lien invalide ou expiré' });
  res.json(format(pl, req.user, true, songResolver));
}));

/* ---------------------------------------------------------------------
 * 4. DÉTAIL D'UNE PLAYLIST (invité autorisé selon la visibilité)
 * Cas d'utilisation : ouvrir une playlist depuis la liste ou la communauté.
 *   - publique  : visible par tous
 *   - non listée / privée : visible uniquement par son propriétaire
 *     (les autres passent par le lien de partage)
 * GET /api/playlists/:id
 * ------------------------------------------------------------------- */
router.get('/:id', optionalAuth, asyncH(async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ error: 'Identifiant invalide' });
  const pl = await Playlist.findById(req.params.id).populate('owner', 'username avatarUrl').lean();
  if (!pl) return res.status(404).json({ error: 'Playlist introuvable' });

  const isOwner = !!req.user && req.user.sub === String(pl.owner._id);
  if (pl.visibility !== 'public' && !isOwner) {
    // On répond 404 (et non 403) pour ne pas révéler l'existence d'une playlist privée.
    return res.status(404).json({ error: 'Playlist introuvable' });
  }
  res.json(format(pl, req.user, true, songResolver));
}));

/* ---------------------------------------------------------------------
 * 5. CRÉER UNE PLAYLIST (connecté)
 * Cas d'utilisation : bouton « Nouvelle playlist ». Privée par défaut.
 * POST /api/playlists   { title, description?, visibility? }
 * ------------------------------------------------------------------- */
router.post('/', auth, asyncH(async (req, res) => {
  const title = clean(req.body.title);
  const description = clean(req.body.description);
  const visibility = req.body.visibility || 'private';

  if (!title || title.length > 150) return res.status(400).json({ error: 'Titre requis (150 caractères max)' });
  if (description.length > 1000) return res.status(400).json({ error: 'Description trop longue (1000 max)' });
  if (!VISIBILITIES.includes(visibility)) return res.status(400).json({ error: 'Visibilité invalide' });

  const pl = await Playlist.create({ owner: req.user.sub, title, description, visibility });
  res.status(201).json(format(pl, req.user, true, songResolver));
}));

/* ---------------------------------------------------------------------
 * 6. MODIFIER UNE PLAYLIST (propriétaire)
 * Cas d'utilisation : renommer, changer la description ou la visibilité.
 * PUT /api/playlists/:id   { title?, description?, visibility? }
 * ------------------------------------------------------------------- */
router.put('/:id', auth, asyncH(async (req, res) => {
  const pl = await loadOwned(req, res);
  if (!pl) return;

  if (req.body.title !== undefined) {
    const title = clean(req.body.title);
    if (!title || title.length > 150) return res.status(400).json({ error: 'Titre invalide (150 caractères max)' });
    pl.title = title;
  }
  if (req.body.description !== undefined) {
    const description = clean(req.body.description);
    if (description.length > 1000) return res.status(400).json({ error: 'Description trop longue (1000 max)' });
    pl.description = description;
  }
  if (req.body.visibility !== undefined) {
    if (!VISIBILITIES.includes(req.body.visibility)) return res.status(400).json({ error: 'Visibilité invalide' });
    pl.visibility = req.body.visibility;
  }
  await pl.save();
  res.json(format(pl, req.user, true, songResolver));
}));

/* ---------------------------------------------------------------------
 * 7. SUPPRIMER UNE PLAYLIST (propriétaire ou admin)
 * Cas d'utilisation : suppression définitive. Les posts de la communauté
 * qui la partageaient perdent simplement leur lien vers elle.
 * DELETE /api/playlists/:id
 * ------------------------------------------------------------------- */
router.delete('/:id', auth, asyncH(async (req, res) => {
  const pl = await loadOwned(req, res, { allowAdmin: true });
  if (!pl) return;
  await Post.updateMany({ playlist: pl._id }, { $set: { playlist: null } });
  await pl.deleteOne();
  res.json({ message: 'Playlist supprimée' });
}));

/* ---------------------------------------------------------------------
 * 8. AJOUTER UN MORCEAU (propriétaire)
 * Cas d'utilisation : bouton « Ajouter à la playlist » sur un morceau.
 * trackId est l'identifiant de la chanson du catalogue (song_id).
 * POST /api/playlists/:id/tracks   { trackId }
 * ------------------------------------------------------------------- */
router.post('/:id/tracks', auth, asyncH(async (req, res) => {
  const pl = await loadOwned(req, res);
  if (!pl) return;

  const trackId = clean(req.body.trackId);
  if (!trackId || trackId.length > 100) return res.status(400).json({ error: 'trackId requis' });
  if (pl.tracks.some((t) => t.trackId === trackId)) {
    return res.status(409).json({ error: 'Ce morceau est déjà dans la playlist' });
  }
  if (pl.tracks.length >= 500) return res.status(400).json({ error: 'Playlist pleine (500 morceaux max)' });

  const position = pl.tracks.reduce((max, t) => Math.max(max, t.position), 0) + 1;
  pl.tracks.push({ trackId, position, addedAt: new Date() });
  await pl.save();
  res.status(201).json(format(pl, req.user, true, songResolver));
}));

/* ---------------------------------------------------------------------
 * 9. RETIRER UN MORCEAU (propriétaire)
 * Cas d'utilisation : bouton « Retirer de la playlist ». Les positions
 * sont renumérotées pour ne pas laisser de trou.
 * DELETE /api/playlists/:id/tracks/:trackId
 * ------------------------------------------------------------------- */
router.delete('/:id/tracks/:trackId', auth, asyncH(async (req, res) => {
  const pl = await loadOwned(req, res);
  if (!pl) return;

  const before = pl.tracks.length;
  const kept = [...pl.tracks]
    .filter((t) => t.trackId !== req.params.trackId)
    .sort((a, b) => a.position - b.position);
  if (kept.length === before) return res.status(404).json({ error: 'Morceau absent de la playlist' });

  pl.tracks = kept.map((t, i) => ({ trackId: t.trackId, position: i + 1, addedAt: t.addedAt }));
  await pl.save();
  res.json(format(pl, req.user, true, songResolver));
}));

/* ---------------------------------------------------------------------
 * 10. GÉNÉRER UN LIEN DE PARTAGE (propriétaire)
 * Cas d'utilisation : bouton « Partager ». Crée un jeton aléatoire
 * impossible à deviner. Une playlist privée devient « non listée » :
 * invisible dans « Découvrir », mais ouverte à qui possède le lien.
 * POST /api/playlists/:id/share
 * ------------------------------------------------------------------- */
router.post('/:id/share', auth, asyncH(async (req, res) => {
  const pl = await loadOwned(req, res);
  if (!pl) return;

  if (!pl.shareToken) pl.shareToken = crypto.randomBytes(24).toString('hex');
  if (pl.visibility === 'private') pl.visibility = 'unlisted';
  await pl.save();

  const base = process.env.CLIENT_URL || 'http://localhost:5173';
  res.json({
    shareToken: pl.shareToken,
    visibility: pl.visibility,
    shareUrl: `${base}/playlist/shared/${pl.shareToken}`,
  });
}));

/* ---------------------------------------------------------------------
 * 11. RÉVOQUER LE LIEN DE PARTAGE (propriétaire)
 * Cas d'utilisation : bouton « Arrêter le partage ». L'ancien lien cesse
 * de fonctionner ; une playlist non listée repasse en privée.
 * DELETE /api/playlists/:id/share
 * ------------------------------------------------------------------- */
router.delete('/:id/share', auth, asyncH(async (req, res) => {
  const pl = await loadOwned(req, res);
  if (!pl) return;

  pl.shareToken = undefined;
  if (pl.visibility === 'unlisted') pl.visibility = 'private';
  await pl.save();
  res.json({ message: 'Partage désactivé', visibility: pl.visibility });
}));

module.exports = { router, createPlaylistRouter };