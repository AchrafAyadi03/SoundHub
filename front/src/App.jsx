import { useCallback, useState } from 'react';
import {
  Activity as ActivityIcon, BarChart3, Disc3, Headphones, History as HistoryIcon,
  Home, Library, Menu, Search, X,
} from 'lucide-react';
import { api } from './api.js';
import { Avatar, Button, Toast } from './components.jsx';
import { PlayerProvider, usePlayer } from './context/PlayerContext.jsx';
import PlayerBar from './components/PlayerBar.jsx';
import NowPlaying from './components/NowPlaying.jsx';
import QueuePanel from './components/QueuePanel.jsx';
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

function AppShell({ userId, setUserId, search, setSearch, page, setPage, menuOpen, setMenuOpen, toast, setToast, notify }) {
  const player = usePlayer();

  const recordEvent = useCallback(async (song, eventType, queue) => {
    const activeUser = userId.trim();
    if (!activeUser) {
      notify('Renseignez un identifiant utilisateur.', 'error');
      return;
    }
    if (eventType === 'play') {
      player.playSong(song, queue);
      return;
    }
    try {
      await api.addEvent({
        user_id: activeUser,
        song_id: song.song_id || song.id,
        event_type: eventType,
        duration_listened_ms: eventType === 'play' ? (song.duration_ms || 0) : eventType === 'skip' ? 15000 : 0,
        device: 'web',
      });
      const labels = { play: 'Écoute enregistrée', skip: 'Passage enregistré', add: 'Ajout enregistré' };
      notify(`${labels[eventType]} · ${song.track_name || song.song_id}`);
      return true;
    } catch (error) {
      notify(`Impossible d’enregistrer l’événement : ${error.message}`, 'error');
      return false;
    }
  }, [notify, userId]);

  const goTo = (id) => {
    const labels = { catalogue: 'Catalogue', history: 'Historique', activity: 'Activité', stats: 'Top', home: 'Accueil' };
    player.setContextLabel(labels[id] || 'Catalogue');
    setPage(id);
    setMenuOpen(false);
  };
  const submitSearch = (event) => {
    event.preventDefault();
    goTo('catalogue');
  };

  return (
    <div className={`app-shell ${player.nowPlayingOpen ? 'app-shell-player-open' : ''}`}>
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`} aria-label="Navigation principale">
        <a
          className="brand transition-opacity duration-200 ease-in-out hover:opacity-80"
          href="#accueil"
          onClick={(event) => { event.preventDefault(); goTo('home'); }}
        >
          <span className="brand-mark"><Disc3 size={21} /></span>
          <span>Sound<span className="brand-accent">Hub</span><small>ESPACE MUSICAL</small></span>
        </a>
        <div className="nav-label">ESPACE</div>
        <nav className="side-nav">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const selected = page === id;
            return (
              <button
                key={id}
                className={`nav-item relative overflow-hidden transition-all duration-200 ease-in-out hover:bg-white/5 ${selected ? "selected bg-white/5 text-accent before:absolute before:left-0 before:top-1/2 before:h-6 before:w-1 before:-translate-y-1/2 before:rounded-r before:bg-emerald-400 before:content-['']" : ''}`}
                onClick={() => goTo(id)}
                aria-current={selected ? 'page' : undefined}
              >
                <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
              </button>
            );
          })}
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
          <form className="global-search flex h-12 items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 transition-all duration-200 ease-in-out focus-within:border-emerald-400/50 focus-within:ring-2 focus-within:ring-emerald-400/20" role="search" onSubmit={submitSearch}>
            <Search size={18} aria-hidden="true" className="text-gray-400" />
            <input
              className="h-full w-full min-w-0 border-0 bg-transparent text-sm text-white placeholder:text-gray-500 outline-none focus:outline-none focus:ring-0"
              aria-label="Rechercher dans le catalogue"
              placeholder="Rechercher un titre, un artiste…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <kbd className="hidden rounded border border-white/10 px-1.5 text-xs text-gray-400 sm:inline">↵</kbd>
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

      <PlayerBar onAdd={(song) => recordEvent(song, 'add')} />
      <NowPlaying onAdd={(song) => recordEvent(song, 'add')} />
      {player.queueOpen && <aside className="queue-float"><QueuePanel onClose={() => player.setQueueOpen(false)} /></aside>}
      {toast && <Toast key={toast.key} message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState('home');
  const [userId, setUserId] = useState('U00001');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const notify = useCallback((message, tone = 'success') => {
    setToast({ message, tone, key: Date.now() });
  }, []);
  return (
    <PlayerProvider userId={userId} notify={notify}>
      <AppShell
        userId={userId}
        setUserId={setUserId}
        search={search}
        setSearch={setSearch}
        page={page}
        setPage={setPage}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        toast={toast}
        setToast={setToast}
        notify={notify}
      />
    </PlayerProvider>
  );
}
