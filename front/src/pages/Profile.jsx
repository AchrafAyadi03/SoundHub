import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Mail, Music2, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Avatar } from '../components.jsx';

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <main className="profile-page">
      <header className="profile-header">
        <div className="profile-avatar">
          {user.avatarUrl
            ? <img src={user.avatarUrl} alt="" />
            : <Avatar name={user.username} />}
        </div>
        <div>
          <span className="profile-kicker">Compte SoundHub</span>
          <h1>{user.username}</h1>
          <p>{user.bio || 'Bienvenue dans votre espace personnel.'}</p>
        </div>
      </header>

      <section className="profile-grid" aria-label="Informations du profil">
        <article className="profile-card">
          <UserRound size={20} />
          <div>
            <span>Nom d'utilisateur</span>
            <strong>{user.username}</strong>
          </div>
        </article>
        <article className="profile-card">
          <Mail size={20} />
          <div>
            <span>Adresse email</span>
            <strong>{user.email}</strong>
          </div>
        </article>
      </section>

      <section className="profile-actions">
        <Link className="profile-action" to="/playlists">
          <Music2 size={18} />
          Mes playlists
        </Link>
        <button type="button" className="profile-action profile-action-danger" onClick={handleLogout}>
          <LogOut size={18} />
          Se déconnecter
        </button>
      </section>
    </main>
  );
}
