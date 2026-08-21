import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandMark from '../components/brand/BrandMark';
import Icon from '../components/common/Icon';

/**
 * Chrome shared by every page a signed-out visitor can reach.
 *
 * The landing page, the full alert list and the centre directory all sit
 * inside this, so following "view all" does not drop someone into a differently
 * shaped page. Nothing here requires an account: the public surface is
 * deliberately usable by a person who is evacuating and has never registered.
 */

const EMERGENCY_NUMBERS = [
  { label: 'Police', number: '100' },
  { label: 'Ambulance', number: '102' },
  { label: 'Fire', number: '101' },
  { label: 'Emergency Operation Centre', number: '1155' }
];

function PublicLayout({ children }) {
  const { isAuthenticated, user } = useAuth();

  const dashboardPath = {
    RESIDENT: '/resident',
    FLOOD_MONITORING_OFFICER: '/officer',
    EVACUATION_OFFICER: '/evacuation',
    ADMINISTRATOR: '/admin'
  }[user?.role?.code] || '/resident';

  return (
    <div className="public-shell">
      <a className="visually-hidden-focusable skip-link" href="#public-content">
        Skip to main content
      </a>

      <header className="public-nav">
        <div className="container d-flex justify-content-between align-items-center gap-2 py-2">
          <Link className="fn-brand-link" to="/">
            <BrandMark size={34} />
            <span className="fn-wordmark">Flood<span className="brand-accent">Net</span></span>
          </Link>

          <nav className="d-flex align-items-center gap-2" aria-label="Primary">
            <Link className="public-nav-link d-none d-md-inline-flex" to="/alerts">Alerts</Link>
            <Link className="public-nav-link d-none d-md-inline-flex" to="/centres">Evacuation centres</Link>

            {isAuthenticated ? (
              <Link className="btn btn-light btn-sm" to={dashboardPath}>
                My dashboard
                <Icon name="arrowRight" size={15} />
              </Link>
            ) : (
              <>
                <Link className="btn btn-outline-light btn-sm d-none d-sm-inline-flex" to="/register">
                  Create account
                </Link>
                <Link className="btn btn-light btn-sm" to="/login">
                  <Icon name="lock" size={14} />
                  Sign in
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main id="public-content">{children}</main>

      <footer className="public-foot mt-auto">
        <div className="container">
          <div className="row g-4 g-lg-5">
            <div className="col-12 col-lg-4">
              <Link className="fn-brand-link" to="/">
                <BrandMark size={30} />
                <span className="fn-wordmark text-white">Flood<span className="brand-accent">Net</span></span>
              </Link>
              <p className="small mt-3 mb-0 fn-foot-text">
                Community flood reporting, officer verification and evacuation coordination for Nepal,
                kept in one place so what has been checked is never confused with what has not.
              </p>
            </div>

            <div className="col-6 col-lg-2">
              <h2 className="fn-foot-heading">Live</h2>
              <ul className="fn-foot-list">
                <li><Link to="/alerts">Active alerts</Link></li>
                <li><Link to="/centres">Evacuation centres</Link></li>
              </ul>
            </div>

            <div className="col-6 col-lg-2">
              <h2 className="fn-foot-heading">Account</h2>
              <ul className="fn-foot-list">
                <li><Link to="/login">Sign in</Link></li>
                <li><Link to="/register">Create account</Link></li>
                {isAuthenticated && <li><Link to={dashboardPath}>My dashboard</Link></li>}
              </ul>
            </div>

            {/* Tappable on a phone, which is where someone in trouble will be. */}
            <div className="col-12 col-lg-4">
              <h2 className="fn-foot-heading">In an emergency</h2>
              <ul className="fn-foot-numbers">
                {EMERGENCY_NUMBERS.map((contact) => (
                  <li key={contact.number}>
                    <a href={`tel:${contact.number}`}>
                      <span>{contact.label}</span>
                      <strong>{contact.number}</strong>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <hr className="fn-rule my-4" />

          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
            <p className="small mb-0 fn-foot-text">
              FloodNet is an information and coordination platform, not an emergency call service.
              In a life-threatening emergency, call Nepal Police on 100 or Ambulance on 102.
            </p>
            <p className="small mb-0 fn-foot-text">
              &copy; {new Date().getFullYear()} FloodNet
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default PublicLayout;
