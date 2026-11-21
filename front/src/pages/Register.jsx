/* =====================================================================
 * src/pages/Register.jsx : page d'inscription
 * ---------------------------------------------------------------------
 * Cas d'utilisation : un invité crée son compte. Une fois inscrit, il est
 * connecté automatiquement.
 * ===================================================================== */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
    <form className="auth-form" onSubmit={handleSubmit}>
      <h1>Créer un compte</h1>
      {error && <p className="form-error" role="alert">{error}</p>}

      <label>Nom d'utilisateur
        <input value={username} onChange={(e) => setUsername(e.target.value)} required minLength={2} maxLength={50} autoComplete="username" />
      </label>
      <label>Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      </label>
      <label>Mot de passe (8 caractères min.)
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
      </label>
      <label>Confirmer le mot de passe
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
      </label>

      <button type="submit" disabled={busy}>{busy ? 'Création…' : "S'inscrire"}</button>
      <p>Déjà un compte ? <Link to="/login">Se connecter</Link></p>
    </form>
  );
}