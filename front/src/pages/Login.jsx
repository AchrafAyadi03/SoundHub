/* =====================================================================
 * src/pages/Login.jsx : page de connexion
 * ---------------------------------------------------------------------
 * Cas d'utilisation : un utilisateur existant se connecte pour créer et
 * partager des playlists et participer à la communauté.
 * ===================================================================== */
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from?.pathname || '/'; // page demandée avant la redirection

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <form className="auth-form" onSubmit={handleSubmit}>
      <h1>Connexion</h1>
      {error && <p className="form-error" role="alert">{error}</p>}

      <label>Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      </label>
      <label>Mot de passe
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
      </label>

      <button type="submit" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>
      <p>Pas encore de compte ? <Link to="/register">Créer un compte</Link></p>
      <p><Link to="/">Continuer en tant qu'invité</Link></p>
    </form>
  );
}