import { NavLink } from 'react-router-dom';

const links = [
  { to: '/admin', label: 'Configurações', end: true },
  { to: '/admin/participantes', label: 'Lista de Participantes' },
  { to: '/admin/sorteio-grupos', label: 'Sorteio de Grupos' },
  { to: '/admin/confrontos-copa', label: 'Confrontos da Copa' },
  { to: '/admin/exclusivos', label: 'Premiação' },
];

export function AdminNav() {
  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
      <div className="container-fluid">
        <span className="navbar-brand">Painel Admin</span>
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
          aria-controls="navbarNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon" />
        </button>
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav">
            {links.map((link) => (
              <li className="nav-item" key={link.to}>
                <NavLink
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
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
