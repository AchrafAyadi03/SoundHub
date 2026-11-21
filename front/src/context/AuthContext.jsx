/* =====================================================================
 * src/context/AuthContext.jsx : état d'authentification global
 * ---------------------------------------------------------------------
 * Cas d'utilisation : savoir, depuis n'importe quel composant, si le
 * visiteur est INVITÉ (user = null) ou CONNECTÉ (user = { id, username... }),
 * et disposer des actions login / register / logout.
 * Usage : const { user, login, logout } = useAuth();
 * ===================================================================== */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { http as api, refreshSession, setAccessToken, setAuthLostHandler } from '../api';


const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true tant qu'on vérifie la session

  /* Au chargement de l'application : tente de restaurer la session grâce
   * au cookie "refresh". Sans cookie valide, le visiteur reste invité
   * (une erreur 401 dans la console à ce moment-là est normale). */
  useEffect(() => {
    setAuthLostHandler(() => setUser(null));
    refreshSession()
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  /* Connexion : mémorise l'access token et l'utilisateur. */
  const login = async (email, password) => {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } });
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data.user;
  };

  /* Inscription : le serveur connecte directement le nouvel utilisateur. */
  const register = async (username, email, password) => {
    const data = await api('/auth/register', { method: 'POST', body: { username, email, password } });
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data.user;
  };

  /* Déconnexion : supprime la session côté serveur puis côté React. */
  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  };

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);