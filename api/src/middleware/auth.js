
const jwt = require('jsonwebtoken');
const redis = require('../config/redis');

/* ---------------------------------------------------------------------
 * auth : route PROTÉGÉE.
 * Cas d'utilisation : créer/modifier une playlist, publier, commenter...
 * Refuse la requête (401) si l'utilisateur n'est pas connecté.
 * ------------------------------------------------------------------- */

exports.auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Non authentifié' });
  try {
    req.user = jwt.verify(token, process.env.ACCESS_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré' });
  }
};

/* ---------------------------------------------------------------------
 * optionalAuth : route PUBLIQUE (mode invité autorisé).
 * Cas d'utilisation : parcourir les playlists publiques et la communauté.
 * Si un token valide est présent, req.user est rempli, sinon on continue
 * simplement en tant qu'invité.
 * ------------------------------------------------------------------- */

exports.optionalAuth = (req, _res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try { req.user = jwt.verify(token, process.env.ACCESS_SECRET); } catch {}
  }
  next();
};

/* ---------------------------------------------------------------------
 * loginLimiter : anti force brute.
 * Cas d'utilisation : limiter à 10 tentatives de connexion par IP
 * toutes les 15 minutes (compteur stocké dans Redis).
 * ------------------------------------------------------------------- */
exports.loginLimiter = async (req, res, next) => {
  try {
    const key = `login:${req.ip}`;
    const attempts = await redis.incr(key);
    if (attempts === 1) await redis.expire(key, 15 * 60);
    if (attempts > 10)
      return res.status(429).json({ error: 'Trop de tentatives, réessayez plus tard' });
    next();
  } catch (err) {
    next(err);
  }
};