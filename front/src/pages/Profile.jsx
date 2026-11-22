import { useSearchParams, useNavigate } from 'react-router-dom';
import { Activity as ActivityIcon, BarChart3, History as HistoryIcon, LogOut, Mail, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Avatar } from '../components.jsx';
import History from './History.jsx';
import Activity from './Activity.jsx';
import Stats from './Stats.jsx';
import '../styles/dock.css';

const TABS = [
  { id: 'overview', label: 'Aperçu', icon: UserRound },
  { id: 'history', label: 'Historique', icon: HistoryIcon },
  { id: 'activity', label: 'Activité', icon: ActivityIcon },
  { id: 'stats', label: 'Statistiques', icon: BarChart3 },
];

function ProfileOverview() {
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
          <div><span>Nom d'utilisateur</span><strong>{user.username}</strong></div>
        </article>
        <article className="profile-card">
          <Mail size={20} />
          <div><span>Adresse email</span><strong>{user.email}</strong></div>
        </article>
      </section>

      <button type="button" className="profile-action profile-action-danger" onClick={handleLogout}>
        <LogOut size={18} />
        Se déconnecter
      </button>
    </main>
  );
}

export default function Profile({ userId }) {
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab = TABS.some((item) => item.id === requested) ? requested : 'overview';
  const index = TABS.findIndex((item) => item.id === tab);

  return (
    <div className="profile-hub">
      <div className="hub-tabs" role="tablist" style={{ '--i': index, '--n': TABS.length }}>
        <span className="hub-tab-pill" aria-hidden="true" />
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`hub-tab ${tab === id ? 'is-active' : ''}`}
            onClick={() => setParams(id === 'overview' ? {} : { tab: id }, { replace: true })}
          >
            <Icon size={16} strokeWidth={1.9} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="hub-panel" key={tab} role="tabpanel">
        {tab === 'overview' && <ProfileOverview />}
        {tab === 'history' && <History userId={userId} />}
        {tab === 'activity' && <Activity />}
        {tab === 'stats' && <Stats />}
      </div>
    </div>
  );
}
