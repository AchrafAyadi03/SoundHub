import { useState } from 'react';
import { Activity as ActivityIcon } from 'lucide-react';
import { api } from '../api.js';
import { useFetch } from '../hooks.js';
import { DEFAULT_DAY } from '../config.js';
import { Badge, EmptyState, ErrorState, LoadingState, SongCell, Table, getRows } from '../components.jsx';

export default function Activity() {
  const [day, setDay] = useState(DEFAULT_DAY);
  const [limit, setLimit] = useState(50);
  const result = useFetch(() => api.activity(day, limit), [day, limit]);
  const events = getRows(result.data);

  return (
    <div className="page-stack">
      <div className="page-title-row">
        <div><span className="eyebrow">COMMUNAUTÉ</span><h1>Journal d’activité</h1><p>Un aperçu chronologique des interactions sur SoundHub.</p></div>
        <span className="title-icon"><ActivityIcon size={22} /></span>
      </div>
      <section className="filter-bar">
        <label><span>Jour (UTC)</span><input type="date" value={day} onChange={(event) => setDay(event.target.value)} /></label>
        <label><span>Nombre de lignes</span><select value={limit} onChange={(event) => setLimit(Number(event.target.value))}>{[20, 50, 100, 200].map((value) => <option key={value} value={value}>{value} événements</option>)}</select></label>
        <span className="result-count">{events.length ? `${events.length} événements` : ''}</span>
      </section>
      {result.loading ? <LoadingState rows={7} /> : result.error ? <ErrorState message={result.error} onRetry={result.retry} /> : !events.length ? <EmptyState title="Aucune activité ce jour" description="Choisissez une autre date pour consulter le journal." /> : (
        <Table>
          <thead><tr><th>Heure</th><th>Utilisateur</th><th>Chanson</th><th>Type</th><th>Appareil</th></tr></thead>
          <tbody>{events.map((event, index) => {
            const date = new Date(event.event_ts);
            return <tr key={event.event_id || index}>
              <td className="time-cell">{Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
              <td><span className="user-cell">{event.user_id}</span></td>
              <td><SongCell e={event} /></td>
              <td><Badge type={event.event_type} /></td>
              <td className="muted">{event.device || '—'}</td>
            </tr>;
          })}</tbody>
        </Table>
      )}
    </div>
  );
}
