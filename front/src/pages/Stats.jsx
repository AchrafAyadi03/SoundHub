import { useState } from 'react';
import { CirclePlus, Headphones, SkipForward, BarChart3 } from 'lucide-react';
import { api } from '../api.js';
import { useFetch } from '../hooks.js';
import { DEFAULT_DAY } from '../config.js';
import { Badge, EmptyState, ErrorState, LoadingState, SongCover, Table, getRows } from '../components.jsx';

export default function Stats() {
  const top = useFetch(() => api.topSongs(10), []);
  const [selected, setSelected] = useState(null);
  const [day, setDay] = useState(DEFAULT_DAY);
  const songId = selected?.song_id;
  const events = useFetch(
    () => (songId ? api.songEvents(songId, day, 50) : Promise.resolve([])),
    [songId, day]
  );
  const songs = getRows(top.data);
  const totals = songs.reduce((sum, song) => ({
    plays: sum.plays + Number(song.plays || 0),
    skips: sum.skips + Number(song.skips || 0),
    adds: sum.adds + Number(song.adds || 0),
  }), { plays: 0, skips: 0, adds: 0 });
  const max = Math.max(1, ...songs.map((song) => Number(song.plays) || 0));
  const eventRows = getRows(events.data);

  return (
    <div className="page-stack">
      <div className="page-title-row">
        <div><span className="eyebrow">VUE D’ENSEMBLE</span><h1>Statistiques</h1><p>Les usages et titres les plus populaires de la plateforme.</p></div>
        <span className="title-icon"><BarChart3 size={22} /></span>
      </div>
      {top.loading ? <LoadingState rows={3} /> : top.error ? <ErrorState message={top.error} onRetry={top.retry} /> : (
        <>
          <section className="kpi-grid" aria-label="Indicateurs clés">
            <article className="kpi-card"><span className="kpi-icon kpi-play"><Headphones size={18} /></span><span className="kpi-label">Écoutes du top 10</span><strong>{totals.plays.toLocaleString('fr-FR')}</strong><span className="kpi-caption">écoutes enregistrées</span></article>
            <article className="kpi-card"><span className="kpi-icon kpi-skip"><SkipForward size={18} /></span><span className="kpi-label">Passages</span><strong>{totals.skips.toLocaleString('fr-FR')}</strong><span className="kpi-caption">titres passés</span></article>
            <article className="kpi-card"><span className="kpi-icon kpi-add"><CirclePlus size={18} /></span><span className="kpi-label">Ajouts</span><strong>{totals.adds.toLocaleString('fr-FR')}</strong><span className="kpi-caption">titres ajoutés</span></article>
          </section>
          <section className="chart-card">
            <div className="section-heading chart-heading">
              <div><span className="eyebrow">CLASSEMENT</span><h2>Top 10 des écoutes</h2><p>Nombre d’écoutes par titre · cliquez pour les détails.</p></div>
              <span className="chart-legend"><i /> Écoutes</span>
            </div>
            {!songs.length ? <EmptyState title="Aucune statistique disponible" description="Les indicateurs apparaîtront dès que des événements seront enregistrés." /> : (
              <div className="chart-list">
                {songs.slice(0, 10).map((song, index) => {
                  const plays = Number(song.plays) || 0;
                  return <button key={song.song_id || index} className={`chart-row ${selected?.song_id === song.song_id ? 'chart-selected' : ''}`} onClick={() => setSelected(song)}>
                    <span className="chart-rank">{String(index + 1).padStart(2, '0')}</span>
                    <SongCover song={song} size="sm" />
                    <span className="chart-label"><strong>{song.track_name || song.song_id}</strong><span>{song.artists || 'Artiste inconnu'}</span></span>
                    <span className="chart-track"><i style={{ width: `${Math.max(1, plays / max * 100)}%` }} /></span>
                    <strong className="chart-value">{plays.toLocaleString('fr-FR')}</strong>
                  </button>;
                })}
              </div>
            )}
          </section>
        </>
      )}
      {selected && (
        <section className="events-section">
          <div className="section-heading">
            <div><span className="eyebrow">DÉTAIL DU TITRE</span><h2>{selected.track_name || selected.song_id}</h2><p>{selected.artists || 'Artiste inconnu'} · événements par jour</p></div>
            <label className="date-inline"><span>Jour (UTC)</span><input type="date" value={day} onChange={(event) => setDay(event.target.value)} /></label>
          </div>
          {events.loading ? <LoadingState rows={3} /> : events.error ? <ErrorState message={events.error} onRetry={events.retry} /> : !eventRows.length ? <EmptyState title="Aucun événement pour ce jour" description="Sélectionnez une autre date pour consulter ce titre." /> : (
            <Table>
              <thead><tr><th>Heure</th><th>Utilisateur</th><th>Événement</th><th>Appareil</th></tr></thead>
              <tbody>{eventRows.map((event, index) => {
                const date = new Date(event.event_ts);
                return <tr key={event.event_id || index}><td>{Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString('fr-FR')}</td><td>{event.user_id}</td><td><Badge type={event.event_type} /></td><td className="muted">{event.device || '—'}</td></tr>;
              })}</tbody>
            </Table>
          )}
        </section>
      )}
    </div>
  );
}
