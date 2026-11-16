import { useCallback, useState } from 'react';
import {
  Activity as ActivityIcon, BarChart3, Disc3, Headphones, History as HistoryIcon,
  Home, Library, Menu, Play, Plus, Search, SkipForward, X,
} from 'lucide-react';
import { api } from './api.js';
import { Avatar, Button, SongCover, Toast, formatDuration } from './components.jsx';
import Activity from './pages/Activity.jsx';
import Catalogue from './pages/Catalogue.jsx';
import History from './pages/History.jsx';
import HomePage from './pages/Home.jsx';
import Stats from './pages/Stats.jsx';

const NAV_ITEMS = [
  { id: 'home', label: 'Accueil', icon: Home },
  { id: 'catalogue', label: 'Catalogue', icon: Library },
  { id: 'history', label: 'Historique', icon: HistoryIcon },
  { id: 'activity', label: 'Activité', icon: ActivityIcon },
  { id: 'stats', label: 'Statistiques', icon: BarChart3 },
];

export default function App() {
  const [page, setPage] = useState('home');
  const [userId, setUserId] = useState('U00001');
  const [search, setSearch] = useState('');
  const [playerSong, setPlayerSong] = useState(null);
  const [toast, setToast] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const notify = useCallback((message, tone = 'success') => {
    setToast({ message, tone, key: Date.now() });
  }, []);

  const recordEvent = useCallback(async (song, eventType) => {
    const activeUser = userId.trim();
    if (!activeUser) {
      notify('Renseignez un identifiant utilisateur.', 'error');
      return;
    }
    try {
      await api.addEvent({
        user_id: activeUser,
        song_id: song.song_id,
        event_type: eventType,
        duration_listened_ms: eventType === 'play' ? (song.duration_ms || 0) : eventType === 'skip' ? 15000 : 0,
        device: 'web',
      });
      if (eventType === 'play') setPlayerSong(song);
      const labels = { play: 'Écoute enregistrée', skip: 'Passage enregistré', add: 'Ajout enregistré' };
      notify(`${labels[eventType]} · ${song.track_name || song.song_id}`);
    } catch (error) {
      notify(`Impossible d’enregistrer l’événement : ${error.message}`, 'error');
    }
  }, [notify, userId]);

  const goTo = (id) => {
    setPage(id);
    setMenuOpen(false);
  };
  const submitSearch = (event) => {
    event.preventDefault();
    goTo('catalogue');
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`} aria-label="Navigation principale">
        <a className="brand" href="#accueil" onClick={(event) => { event.preventDefault(); goTo('home'); }}>
          <span className="brand-mark"><Disc3 size={21} /></span>
          <span>Sound<span className="brand-accent">Hub</span><small>ESPACE MUSICAL</small></span>
        </a>
        <div className="nav-label">ESPACE</div>
        <nav className="side-nav">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${page === id ? 'selected' : ''}`} onClick={() => goTo(id)} aria-current={page === id ? 'page' : undefined}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note"><Headphones size={17} /><span>Votre musique,<br />vos découvertes.</span></div>
          <span className="sidebar-caption">SOUNDHUB · DONNÉES EN TEMPS RÉEL</span>
        </div>
      </aside>

      {menuOpen && <button className="sidebar-scrim" aria-label="Fermer le menu" onClick={() => setMenuOpen(false)} />}
      <div className="main-column">
        <header className="topbar">
          <Button className="mobile-menu icon-button" aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'} onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </Button>
          <form className="global-search" role="search" onSubmit={submitSearch}>
            <Search size={18} aria-hidden="true" />
            <input aria-label="Rechercher dans le catalogue" placeholder="Rechercher un titre, un artiste…" value={search} onChange={(event) => setSearch(event.target.value)} />
            <kbd>↵</kbd>
          </form>
          <div className="user-selector">
            <Avatar name={userId} />
            <label htmlFor="current-user">Utilisateur</label>
            <input id="current-user" value={userId} onChange={(event) => setUserId(event.target.value)} aria-label="Identifiant utilisateur courant" />
          </div>
        </header>

        <main className="page-content" id="main-content">
          {page === 'home' && <HomePage userId={userId.trim()} onEvent={recordEvent} onNavigate={goTo} />}
          {page === 'catalogue' && <Catalogue query={search} onQueryChange={setSearch} onEvent={recordEvent} />}
          {page === 'history' && <History userId={userId.trim()} />}
          {page === 'activity' && <Activity />}
          {page === 'stats' && <Stats />}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="Navigation mobile">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button key={id} className={page === id ? 'selected' : ''} onClick={() => goTo(id)} aria-label={label} aria-current={page === id ? 'page' : undefined}>
            <Icon size={19} /><span>{label}</span>
          </button>
        ))}
      </nav>

      <footer className="player-bar" aria-label="Lecteur de musique">
        <div className="player-track">
          {playerSong ? <SongCover song={playerSong} size="small" /> : <span className="player-empty"><Disc3 size={20} /></span>}
          <div className="player-meta">
            <strong>{playerSong?.track_name || 'Aucune lecture en cours'}</strong>
            <span>{playerSong?.artists || 'Choisissez un titre pour commencer'}</span>
          </div>
        </div>
        <div className="player-center">
          <div className="player-controls">
            <Button className="icon-button" disabled={!playerSong} aria-label="Passer ce titre" onClick={() => playerSong && recordEvent(playerSong, 'skip')}><SkipForward size={18} /></Button>
            <Button className="play-button" disabled={!playerSong} aria-label="Enregistrer une écoute" onClick={() => playerSong && recordEvent(playerSong, 'play')}><Play size={16} fill="currentColor" /></Button>
            <Button className="icon-button" disabled={!playerSong} aria-label="Ajouter ce titre" onClick={() => playerSong && recordEvent(playerSong, 'add')}><Plus size={19} /></Button>
          </div>
          <div className="progress-line"><span /></div>
          <div className="player-times"><span>00:00</span><span>{formatDuration(playerSong?.duration_ms)}</span></div>
        </div>
        <div className="player-status"><span className="live-dot" /> Lecture simulée</div>
      </footer>
      {toast && <Toast key={toast.key} message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  );
}
