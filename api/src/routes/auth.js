const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const redis = require('../config/redis');
const { auth, loginLimiter } = require('../middleware/auth');

const REFRESH_TTL = 60 * 60 * 24 * 7; // 7 jours

const cookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  maxAge: REFRESH_TTL * 1000,
};

const signAccess = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, process.env.ACCESS_SECRET, { expiresIn: '15m' });

async function issueTokens(user, res) {
  const refreshToken = crypto.randomBytes(40).toString('hex');
  await redis.set(`refresh:${refreshToken}`, user.id, 'EX', REFRESH_TTL);
  res.cookie('refresh', refreshToken, cookieOptions);
  return signAccess(user);
}

const publicUser = (u) => ({ id: u.id, username: u.username, email: u.email, avatarUrl: u.avatarUrl, bio: u.bio });

// Inscription
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password || password.length < 8)
      return res.status(400).json({ error: 'Données invalides (mot de passe : 8 caractères min.)' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ username, email, passwordHash });
    const accessToken = await issueTokens(user, res);
    res.status(201).json({ accessToken, user: publicUser(user) });
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ error: 'Nom d\'utilisateur ou email déjà utilisé' });
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Connexion
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() });
    if (!user || !(await bcrypt.compare(password || '', user.passwordHash)))
      return res.status(401).json({ error: 'Identifiants incorrects' });

    const accessToken = await issueTokens(user, res);
    res.json({ accessToken, user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Renouvellement du token d'accès (rotation du refresh token)
router.post('/refresh', async (req, res) => {
  const old = req.cookies.refresh;
  if (!old) return res.status(401).json({ error: 'Pas de session' });

  const userId = await redis.get(`refresh:${old}`);
  if (!userId) return res.status(401).json({ error: 'Session expirée' });

  await redis.del(`refresh:${old}`);
  const user = await User.findById(userId);
  if (!user) return res.status(401).json({ error: 'Utilisateur introuvable' });

  const accessToken = await issueTokens(user, res);
  res.json({ accessToken, user: publicUser(user) });
});

// Déconnexion
router.post('/logout', async (req, res) => {
  const token = req.cookies.refresh;
  if (token) await redis.del(`refresh:${token}`);
  res.clearCookie('refresh', cookieOptions);
  res.json({ message: 'Déconnecté' });
});

// Profil de l'utilisateur connecté
router.get('/me', auth, async (req, res) => {
  const user = await User.findById(req.user.sub);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  res.json(publicUser(user));
});

module.exports = router;