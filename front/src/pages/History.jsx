import { useMemo, useState } from 'react';
import { Clock3, History as HistoryIcon } from 'lucide-react';
import { api } from '../api.js';
import { useFetch } from '../hooks.js';
import { Badge, EmptyState, ErrorState, LoadingState, SongCover, formatDuration, getRows } from '../components.jsx';

function dayLabel(day) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const key = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  if (day === key(today)) return 'Aujourd’hui';
  if (day === key(yesterday)) return 'Hier';
  return new Date(`${day}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export default function History({ userId }) {
  const [type, setType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [limit, setLimit] = useState(50);
  const result = useFetch(
    () => (userId ? api.userEvents(userId, { type, from, to, limit }) : Promise.resolve([])),
    [userId, type, from, to, limit]
  );
  const events = getRows(result.data);
  const groups = useMemo(() => {
    const map = new Map();
    events.forEach((event) => {
      const date = event.event_ts ? new Date(event.event_ts) : null;
      const groupKey = date && !Number.isNaN(date.getTime())
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        : 'Non daté';
      if (!map.has(groupKey)) map.set(groupKey, []);
      map.get(groupKey).push(event);
    });
    return [...map.entries()];
  }, [events]);
  const changeFilter = (setter, value) => { setter(value); setLimit(50); };

  return (
    <div className="page-stack">
      <div className="page-title-row">
        <div><span className="eyebrow">VOTRE ACTIVITÉ</span><h1>Historique</h1><p>Vos dernières interactions, regroupées par jour.</p></div>
        <span className="title-icon"><HistoryIcon size={22} /></span>
      </div>
      <section className="filter-bar">
        <label><span>Type d’événement</span><select value={type} onChange={(event) => changeFilter(setType, event.target.value)}><option value="">Tous les types</option><option value="play">Écoutes</option><option value="skip">Passages</option><option value="add">Ajouts</option></select></label>
        <label><span>Depuis</span><input type="date" value={from} onChange={(event) => changeFilter(setFrom, event.target.value)} /></label>
        <label><span>Jusqu’au (exclu)</span><input type="date" value={to} onChange={(event) => changeFilter(setTo, event.target.value)} /></label>
        <span className="result-count">{events.length ? `${events.length} événements` : ''}</span>
      </section>
      {result.loading ? <LoadingState rows={5} /> : result.error ? <ErrorState message={result.error} onRetry={result.retry} /> : !events.length ? <EmptyState title="Votre historique est vide" description={userId ? 'Vos écoutes, passages et ajouts apparaîtront ici.' : 'Renseignez un identifiant utilisateur dans la barre supérieure.'} /> : (
        <div className="history-groups">
          {groups.map(([day, dayEvents]) => (
            <section className="history-day" key={day}>
              <h2>{dayLabel(day)} <span>{dayEvents.length}</span></h2>
              <div className="history-list">
                {dayEvents.map((event, index) => {
                  const date = new Date(event.event_ts);
                  return <article className="history-item" key={event.event_id || `${day}-${index}`}>
                    <SongCover song={event} size="small" />
                    <div className="history-song"><strong>{event.track_name || event.song_id}</strong><span>{event.artists || 'Artiste inconnu'}{event.album_name ? ` · ${event.album_name}` : ''}</span></div>
                    <div className="history-event"><Badge type={event.event_type} /><span>{formatDuration(event.duration_listened_ms)}</span></div>
                    <span className="history-time"><Clock3 size={14} />{Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </article>;
                })}
              </div>
            </section>
          ))}
          {events.length >= limit && <div className="load-more"><button className="button button-secondary" onClick={() => setLimit((value) => value + 50)}>Charger plus</button></div>}
        </div>
      )}
    </div>
  );
}
