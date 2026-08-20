import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { roleHomePath } from '../routes/roleHome';

function ForbiddenPage() {
  const { user } = useAuth();

  return (
    <main className="auth-shell d-flex align-items-center justify-content-center px-3 py-5">
      <div className="auth-card panel-card p-4 p-md-5 rounded-4 w-100 text-center">
        <span className="eyebrow">Access restricted</span>
        <h1 className="h3 fw-bold mt-3 mb-2">You do not have access to this area</h1>
        <p className="text-secondary mb-4">
          FloodNet keeps operational responsibilities separate, so each role can only reach the
          tools it is accountable for.
        </p>

        <div className="d-flex flex-column flex-sm-row justify-content-center gap-2">
          {user
            ? <Link className="btn btn-primary" to={roleHomePath(user)}>Go to my dashboard</Link>
            : <Link className="btn btn-primary" to="/login">Sign in</Link>}
          <Link className="btn btn-outline-secondary" to="/">Public flood information</Link>
        </div>
      </div>
    </main>
  );
}

export default ForbiddenPage;
