/* =====================================================================
 * src/components/Dock.jsx : navigation horizontale flottante (en haut)
 * ---------------------------------------------------------------------
 * Une pilule de verre : seule la page active affiche son libellé, les
 * autres le révèlent au survol. Masquée sur mobile (mobile-nav prend le relais).
 * ===================================================================== */
import '../styles/dock.css';

export default function Dock({ items, page, onSelect }) {
  return (
    <nav className="dock" aria-label="Navigation principale">
      <div className="dock-track">
        {items.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`dock-item ${page === id ? 'is-active' : ''}`}
            onClick={() => onSelect(id)}
            aria-current={page === id ? 'page' : undefined}
            aria-label={label}
            title={label}
          >
            <span className="dock-icon"><Icon size={19} strokeWidth={1.9} /></span>
            <span className="dock-label">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}