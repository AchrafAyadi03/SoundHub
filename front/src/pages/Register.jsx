/* =====================================================================
 * src/pages/Register.jsx : page d'inscription
 * ---------------------------------------------------------------------
 * Cas d'utilisation : un invité crée son compte. Une fois inscrit, il est
 * connecté automatiquement.
 * Style : identique à la page de connexion (styles/login.css).
 * ===================================================================== */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/login.css';

function EyeIcon({ off }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
      {off && <line x1="3" y1="3" x2="21" y2="21" />}
    </svg>
  );
}

// Champ mot de passe avec bouton afficher / masquer
function PasswordField({ label, value, onChange, placeholder, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <label className="field">
      <span>{label}</span>
      <div className="password-wrap">
        <input
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="eye-btn"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        >
          <EyeIcon off={show} />
        </button>
      </div>
    </label>
  );
}

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // Validation côté client (le serveur revérifie de toute façon).
    if (password.length < 8) return setError('Le mot de passe doit contenir au moins 8 caractères');
    if (password !== confirm) return setError('Les mots de passe ne correspondent pas');

    setBusy(true);
    try {
      await register(username.trim(), email.trim(), password);
      navigate('/', { replace: true });
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

      {/* Carte d'inscription */}
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>INSCRIPTION</h1>
        <p className="login-subtitle">Créez votre compte pour rejoindre la communauté</p>

        {error && <p className="login-error" role="alert">{error}</p>}

        <label className="field">
          <span>Nom d'utilisateur</span>
          <input
            type="text"
            placeholder="Choisissez un nom d'utilisateur"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={2}
            maxLength={50}
            autoComplete="username"
          />
        </label>

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

        <PasswordField
          label="Mot de passe (8 caractères min.)"
          placeholder="Entrez votre mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />

        <PasswordField
          label="Confirmer le mot de passe"
          placeholder="Confirmez votre mot de passe"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />

        <button type="submit" className="login-btn" disabled={busy}>
          {busy ? 'Création…' : "S'inscrire"}
        </button>

        <p className="login-foot">
          Déjà un compte ? <Link to="/login">Se connecter</Link>
        </p>
        <p className="login-foot guest">
          <Link to="/">Continuer en tant qu'invité</Link>
        </p>
      </form>
    </div>
  );
}