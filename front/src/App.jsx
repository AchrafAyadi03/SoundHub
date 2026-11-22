import { useCallback, useEffect, useState } from 'react';
import { Disc3, Heart, Home, Library, ListMusic, Search, UserRound, Users } from 'lucide-react';
import { api } from './api.js';
import { Avatar, Toast } from './components.jsx';
import { PlayerProvider, usePlayer } from './context/PlayerContext.jsx';
import PlayerBar from './components/PlayerBar.jsx';
import NowPlaying from './components/NowPlaying.jsx';
import QueuePanel from './components/QueuePanel.jsx';
import Catalogue from './pages/Catalogue.jsx';
import HomePage from './pages/Home.jsx';

import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Dock from './components/Dock.jsx';
import Login from './pages/Login';
import Register from './pages/Register';
import Community from './pages/Community';
import MyPlaylists from './pages/MyPlaylists';
import ProfileHub from './pages/Profile.jsx';
import LikedSongs from './pages/LikedSongs.jsx';
import PlaylistPicker from './components/PlaylistPicker';
import SharedPlaylist from './pages/SharedPlaylist';

// Historique, Activité et Statistiques vivent maintenant dans le Profil (onglets).
const NAV_ITEMS = [
  { id: 'home', label: 'Accueil', icon: Home },
  { id: 'catalogue', label: 'Catalogue', icon: Library },
  { id: 'community', label: 'Communauté', icon: Users },
  { id: 'playlists', label: 'Mes playlists', icon: ListMusic },
  { id: 'liked', label: 'Titres likés', icon: Heart },
  { id: 'profile', label: 'Profil', icon: UserRound },
];

const PAGE_ROUTES = {
  community: '/community',
  playlists: '/playlists',
  liked: '/liked',
  profile: '/profile',
};
const ROUTE_PAGES = Object.fromEntries(Object.entries(PAGE_ROUTES).map(([page, path]) => [path, page]));

const PAGE_LABELS = {
  home: 'Accueil', catalogue: 'Catalogue', community: 'Communauté',
  playlists: 'Mes playlists', liked: 'Titres likés', profile: 'Profil',
};

function AppShell({ activeUserId, search, setSearch, page, setPage, toast, setToast, notify, playlistSong, setPlaylistSong }) {
  const player = usePlayer();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    const routePage = ROUTE_PAGES[location.pathname];
    if (routePage) setPage(routePage);
    player.setNowPlayingOpen(false);
  }, [location.pathname, setPage]);

  const recordEvent = useCallback(async (song, eventType, queue) => {
    if (eventType === 'playlist') {
      if (!user) {
        navigate('/login');
        return;
      }
      setPlaylistSong(song);
      return;
    }
    const activeUser = activeUserId.trim();
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
  }, [notify, activeUserId, navigate, setPlaylistSong, user]);

  const goTo = (id) => {
    player.setNowPlayingOpen(false);
    player.setContextLabel(PAGE_LABELS[id] || 'Catalogue');
    setPage(id);
    const route = PAGE_ROUTES[id];
    if (route) navigate(route);
    else if (location.pathname !== '/') navigate('/');
  };
  const submitSearch = (event) => {
    event.preventDefault();
    goTo('catalogue');
  };

  return (
    <div className={`app-shell ${player.nowPlayingOpen ? 'app-shell-player-open' : ''}`}>
      <div className="main-column">
        <header className="topnav">
          <a
            className="brand transition-opacity duration-200 ease-in-out hover:opacity-80"
            href="#accueil"
            onClick={(event) => { event.preventDefault(); goTo('home'); }}
          >
            <span className="brand-mark"><Disc3 size={21} /></span>
            <span>Sound<span className="brand-accent">Hub</span></span>
          </a>
          <Dock items={NAV_ITEMS} page={page} onSelect={goTo} />
          <form
            className="topnav-search"
            role="search"
            onSubmit={submitSearch}
            onClick={(event) => event.currentTarget.querySelector('input')?.focus()}
          >
            <Search size={18} aria-hidden="true" className="text-gray-400" />
            <input
              className="topnav-input"
              aria-label="Rechercher dans le catalogue"
              placeholder="Rechercher un titre, un artiste…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </form>
          {user ? (
            <button
              type="button"
              className="auth-account-button"
              onClick={() => goTo('profile')}
              aria-label="Ouvrir mon profil"
              title={`Profil : ${user.username}`}
            >
              <Avatar name={user.username} />
              <span>{user.username}</span>
            </button>
          ) : (
            <button type="button" className="auth-account-button" onClick={() => navigate('/login')}>
              <span>Se connecter</span>
            </button>
          )}
        </header>

        <main className="page-content" id="main-content">
          {page === 'home' && <HomePage userId={activeUserId.trim()} onEvent={recordEvent} onNavigate={goTo} />}
          {page === 'catalogue' && <Catalogue query={search} onQueryChange={setSearch} onEvent={recordEvent} />}
          {page === 'community' && <Community />}
          {page === 'playlists' && (
            <ProtectedRoute><MyPlaylists /></ProtectedRoute>
          )}
          {page === 'liked' && (
            <ProtectedRoute><LikedSongs userId={activeUserId.trim()} onEvent={recordEvent} /></ProtectedRoute>
          )}
          {page === 'profile' && (
            <ProtectedRoute><ProfileHub userId={activeUserId.trim()} /></ProtectedRoute>
          )}
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
      {playlistSong && (
        <PlaylistPicker
          song={playlistSong}
          onClose={() => setPlaylistSong(null)}
          onAdded={(song, title) => notify(`${song.track_name || song.title} ajouté à ${title}`)}
        />
      )}
      {toast && <Toast key={toast.key} message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState('home');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);
  const [playlistSong, setPlaylistSong] = useState(null);
  const { user } = useAuth();
  const activeUserId = user?.id || '';
  const notify = useCallback((message, tone = 'success') => {
    setToast({ message, tone, key: Date.now() });
  }, []);
  return (
    <PlayerProvider userId={activeUserId} notify={notify}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/playlist/shared/:token" element={<SharedPlaylist />} />
        <Route path="/playlist/:id" element={<SharedPlaylist />} />
        <Route
          path="*"
          element={
            <AppShell
              activeUserId={activeUserId}
              search={search}
              setSearch={setSearch}
              page={page}
              setPage={setPage}
              toast={toast}
              setToast={setToast}
              notify={notify}
              playlistSong={playlistSong}
              setPlaylistSong={setPlaylistSong}
            />
          }
        />
      </Routes>
    </PlayerProvider>
  );
}