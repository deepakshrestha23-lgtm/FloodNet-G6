import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE, describe } from '../utils/enums';

/**
 * Navigation is derived from the signed-in role. Hiding a link is presentation
 * only; the matching API route enforces the same restriction on the server.
 */
const NAVIGATION = {
  RESIDENT: [
    { to: '/resident', label: 'Dashboard', end: true },
    { to: '/resident/reports', label: 'My reports' },
    { to: '/resident/reports/new', label: 'Report flooding' },
    { to: '/resident/alerts', label: 'Alerts' },
    { to: '/resident/centres', label: 'Evacuation centres' },
    { to: '/resident/preparedness', label: 'Preparedness' }
  ],
  FLOOD_MONITORING_OFFICER: [
    { to: '/officer', label: 'Situation dashboard', end: true },
    { to: '/officer/reports', label: 'Review queue' },
    { to: '/officer/alerts', label: 'Alerts' },
    { to: '/officer/alerts/new', label: 'New alert' }
  ],
  EVACUATION_OFFICER: [
    { to: '/evacuation', label: 'Dashboard', end: true },
    { to: '/evacuation/centres', label: 'Centres' },
    { to: '/evacuation/centres/new', label: 'Add centre' }
  ],
  ADMINISTRATOR: [
    { to: '/admin', label: 'Overview', end: true },
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/zones', label: 'Flood zones' },
    { to: '/admin/master-data', label: 'Master data' },
    { to: '/admin/audit', label: 'Audit log' }
  ]
};

function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const roleCode = user?.role?.code;
  const links = NAVIGATION[roleCode] || [];
  const roleMeta = describe(ROLE, roleCode);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell d-flex flex-column min-vh-100">
      <a className="visually-hidden-focusable skip-link" href="#main-content">
        Skip to main content
      </a>

      <nav className="navbar navbar-expand-lg app-navbar" aria-label="Main navigation">
        <div className="container-fluid px-3 px-lg-4">
          <Link className="navbar-brand fw-bold" to="/">
            Flood<span className="brand-accent">Net</span>
          </Link>

          <button
            className="navbar-toggler"
            type="button"
            aria-expanded={menuOpen}
            aria-controls="app-navigation"
            aria-label="Toggle navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="navbar-toggler-icon" />
          </button>

          <div className={`collapse navbar-collapse ${menuOpen ? 'show' : ''}`} id="app-navigation">
            <ul className="navbar-nav me-auto mb-2 mb-lg-0">
              {links.map((link) => (
                <li className="nav-item" key={link.to}>
                  <NavLink
                    to={link.to}
                    end={link.end}
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    onClick={() => setMenuOpen(false)}
                  >
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>

            <div className="d-flex flex-column flex-lg-row align-items-lg-center gap-2">
              <NavLink
                to="/profile"
                className={({ isActive }) => `account-link text-decoration-none text-lg-end ${isActive ? 'account-link-active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                <span className="fw-semibold small d-block">
                  {user?.profile?.firstName} {user?.profile?.lastName}
                </span>
                <span className="small text-secondary">{roleMeta.label}</span>
              </NavLink>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleLogout}>
                Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main id="main-content" className="flex-grow-1 container-fluid px-3 px-lg-4 py-4">
        <Outlet />
      </main>

      <footer className="app-footer py-3 px-3 px-lg-4">
        <p className="small mb-0 text-secondary">
          FloodNet — community reports, verified incidents and official alerts are shown separately.
          In a life-threatening emergency contact your local emergency services.
        </p>
      </footer>
    </div>
  );
}

export default AppLayout;
