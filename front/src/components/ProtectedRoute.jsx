/* =====================================================================
 * src/components/ProtectedRoute.jsx : page réservée aux connectés
 * ---------------------------------------------------------------------
 * Cas d'utilisation : protéger « Mes playlists » et toute page qui exige
 * un compte. Un invité est redirigé vers /login, puis ramené sur la page
 * demandée après sa connexion.
 * Usage : <Route path="/playlists" element={<ProtectedRoute><MyPlaylists /></ProtectedRoute>} />
 * ===================================================================== */
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <p>Chargement…</p>; // vérification de la session en cours
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}