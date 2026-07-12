import { useState } from 'react';
import { NavLink } from 'react-router-dom';

const links = [
  { to: '/admin', label: 'Configurações', end: true },
  { to: '/admin/participantes', label: 'Lista de Participantes' },
  { to: '/admin/sorteio-grupos', label: 'Sorteio de Grupos' },
  { to: '/admin/confrontos-copa', label: 'Confrontos da Copa' },
  { to: '/admin/exclusivos', label: 'Premiação' },
];

export function AdminNav() {
  const [expanded, setExpanded] = useState(false);

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
      <div className="container-fluid">
        <span className="navbar-brand">Painel Admin</span>
        <button
          className="navbar-toggler"
          type="button"
          aria-controls="navbarNav"
          aria-expanded={expanded}
          aria-label="Abrir menu"
          onClick={() => setExpanded((open) => !open)}
        >
          <span className="navbar-toggler-icon" />
        </button>
        <div className={`collapse navbar-collapse${expanded ? ' show' : ''}`} id="navbarNav">
          <ul className="navbar-nav">
            {links.map((link) => (
              <li className="nav-item" key={link.to}>
                <NavLink
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                  onClick={() => setExpanded(false)}
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
}
