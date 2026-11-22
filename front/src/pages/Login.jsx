/* =====================================================================
 * src/pages/Login.jsx : page de connexion
 * ---------------------------------------------------------------------
 * Cas d'utilisation : un utilisateur existant se connecte pour créer et
 * partager des playlists et participer à la communauté.
 * Style : glassmorphism, thème vert sombre (voir Login.css).
 * ===================================================================== */
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/login.css'

function EyeIcon({ off }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
      {off && <line x1="3" y1="3" x2="21" y2="21" />}
    </svg>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from?.pathname || '/'; // page demandée avant la redirection

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      {/* Fond fluide animé */}
      <div className="login-bg" aria-hidden="true">
        <span className="blob blob-1" />
        <span className="blob blob-2" />
        <span className="blob blob-3" />
        <span className="silk silk-1" />
        <span className="silk silk-2" />
      </div>

      {/* En-tête */}
      <header className="login-header">
        <Link to="/" className="login-logo">
          <span className="login-logo-icon">♪</span>
          <span>SoundHub</span>
        </Link>
        <Link to="/" className="login-menu">
          <span className="burger" aria-hidden="true"><i /><i /><i /></span>
          ACCUEIL
        </Link>
      </header>

      {/* Carte de connexion */}
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>CONNEXION</h1>
        <p className="login-subtitle">Entrez vos identifiants pour vous connecter</p>

        {error && <p className="login-error" role="alert">{error}</p>}

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            placeholder="Entrez votre email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>

        <label className="field">
          <span>Mot de passe</span>
          <div className="password-wrap">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Entrez votre mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              className="eye-btn"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            >
              <EyeIcon off={showPassword} />
            </button>
          </div>
        </label>

        <div className="login-row">
          <label className="remember">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span>Se souvenir de moi</span>
          </label>
          <Link to="/forgot-password" className="forgot">Mot de passe oublié ?</Link>
        </div>

        <button type="submit" className="login-btn" disabled={busy}>
          {busy ? 'Connexion…' : 'Se connecter'}
        </button>

        <p className="login-foot">
          Pas encore de compte ? <Link to="/register">Créer un compte</Link>
        </p>
        <p className="login-foot guest">
          <Link to="/">Continuer en tant qu'invité</Link>
        </p>
      </form>
    </div>
  );
}