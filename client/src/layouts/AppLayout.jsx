import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE, describe } from '../utils/enums';
import BrandMark from '../components/brand/BrandMark';
import Icon from '../components/common/Icon';

/**
 * Navigation is derived from the signed-in role. Hiding a link is presentation
 * only; the matching API route enforces the same restriction on the server.
 */
const NAVIGATION = {
  RESIDENT: [
    { to: '/resident', label: 'Dashboard', icon: 'dashboard', end: true },
    { to: '/resident/reports', label: 'My reports', icon: 'report' },
    { to: '/resident/reports/new', label: 'Report flooding', icon: 'plus' },
    { to: '/resident/alerts', label: 'Alerts', icon: 'bell' },
    { to: '/resident/centres', label: 'Evacuation centres', icon: 'shelter' },
    { to: '/resident/preparedness', label: 'Preparedness', icon: 'shield' }
  ],
  FLOOD_MONITORING_OFFICER: [
    { to: '/officer', label: 'Situation dashboard', icon: 'radar', end: true },
    { to: '/officer/reports', label: 'Review queue', icon: 'inbox' },
    { to: '/officer/alerts', label: 'Alerts', icon: 'bell' },
    { to: '/officer/alerts/new', label: 'New alert', icon: 'megaphone' }
  ],
  EVACUATION_OFFICER: [
    { to: '/evacuation', label: 'Dashboard', icon: 'dashboard', end: true },
    { to: '/evacuation/alerts', label: 'Active alerts', icon: 'bell' },
    { to: '/evacuation/centres', label: 'Centres', icon: 'shelter' },
    { to: '/evacuation/centres/new', label: 'Add centre', icon: 'plus' }
  ],
  ADMINISTRATOR: [
    { to: '/admin', label: 'Overview', icon: 'dashboard', end: true },
    { to: '/admin/users', label: 'Users', icon: 'users' },
    { to: '/admin/zones', label: 'Flood zones', icon: 'map' },
    { to: '/admin/master-data', label: 'Master data', icon: 'database' },
    { to: '/admin/audit', label: 'Audit log', icon: 'history' }
  ]
};

/** Short label describing the area each role works in, shown in the sidebar. */
const WORKSPACE = {
  RESIDENT: 'Community workspace',
  FLOOD_MONITORING_OFFICER: 'Monitoring workspace',
  EVACUATION_OFFICER: 'Evacuation workspace',
  ADMINISTRATOR: 'Administration'
};

function initialsOf(profile) {
  const first = profile?.firstName?.trim()?.[0] || '';
  const last = profile?.lastName?.trim()?.[0] || '';
  return `${first}${last}`.toUpperCase() || 'FN';
}

function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const roleCode = user?.role?.code;
  const links = NAVIGATION[roleCode] || [];
  const roleMeta = describe(ROLE, roleCode);

  // The drawer is only ever open on small screens; closing it on navigation
  // keeps the current page visible after a link is followed.
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const activeLink = links.find((link) => (link.end
    ? location.pathname === link.to
    : location.pathname.startsWith(link.to)));

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      <a className="visually-hidden-focusable skip-link" href="#main-content">
        Skip to main content
      </a>

      <div className="fn-shell">
        <aside
          id="app-navigation"
          className={`fn-sidebar ${menuOpen ? 'fn-sidebar-open' : ''}`}
          aria-label="Main navigation"
        >
          <Link className="fn-sidebar-brand" to="/">
            <BrandMark size={36} />
            <span>
              <span className="fn-wordmark">Flood<span className="brand-accent">Net</span></span>
              <span className="d-block fn-sidebar-role-label mt-1">Flood intelligence</span>
            </span>
          </Link>

          <div className="fn-sidebar-role">
            <span className="fn-sidebar-role-icon">
              <Icon name="shield" size={18} strokeWidth={2} />
            </span>
            <span>
              <span className="fn-sidebar-role-label d-block">Signed in as</span>
              <span className="fn-sidebar-role-name">{roleMeta.label}</span>
            </span>
          </div>

          <p className="fn-nav-heading">{WORKSPACE[roleCode] || 'Workspace'}</p>

          <ul className="fn-nav">
            {links.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) => `fn-nav-link ${isActive ? 'active' : ''}`}
                  onClick={() => setMenuOpen(false)}
                >
                  <Icon name={link.icon} size={18} />
                  <span>{link.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="fn-sidebar-foot">
            <NavLink
              to="/profile"
              className={({ isActive }) => `fn-nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              <Icon name="user" size={18} />
              <span>My profile</span>
            </NavLink>
            <p className="fn-sidebar-note mt-2">
              In a life-threatening emergency, call Nepal Police on 100 or Ambulance on 102.
            </p>
          </div>
        </aside>

        {menuOpen && (
          <button
            type="button"
            className="fn-sidebar-scrim"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
          />
        )}

        <div className="d-flex flex-column min-vh-100">
          <header className="fn-topbar">
            <button
              type="button"
              className="fn-icon-btn d-lg-none"
              aria-expanded={menuOpen}
              aria-controls="app-navigation"
              aria-label="Toggle navigation"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <Icon name={menuOpen ? 'close' : 'menu'} size={20} />
            </button>

            <div className="d-flex align-items-center gap-2 me-auto">
              <div className="d-lg-none">
                <BrandMark size={28} />
              </div>
              <div>
                <p className="fn-topbar-title">{activeLink?.label || 'FloodNet'}</p>
                <p className="fn-topbar-sub d-none d-sm-block">
                  {WORKSPACE[roleCode] || 'FloodNet workspace'}
                </p>
              </div>
            </div>

            <span className="fn-live-pill d-none d-md-inline-flex">
              <span className="fn-live-dot" />
              Live data
            </span>

            <NavLink
              to="/profile"
              className={({ isActive }) => `account-link ${isActive ? 'account-link-active' : ''}`}
            >
              <span className="fn-avatar">{initialsOf(user?.profile)}</span>
              <span className="d-none d-md-block">
                <span className="fw-semibold small d-block lh-1">
                  {user?.profile?.firstName} {user?.profile?.lastName}
                </span>
                <span className="small text-secondary">{roleMeta.label}</span>
              </span>
            </NavLink>

            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleLogout}>
              <Icon name="logout" size={16} />
              <span className="d-none d-sm-inline">Sign out</span>
            </button>
          </header>

          <main id="main-content" className="fn-main flex-grow-1">
            <Outlet />
          </main>

          <footer className="fn-shell-foot">
            <p className="mb-0">
              FloodNet keeps community reports, verified incidents and official alerts separate.
              In a life-threatening emergency, call Nepal Police on 100 or Ambulance on 102.
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}

export default AppLayout;
