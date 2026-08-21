import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { roleHomePath } from '../routes/roleHome';
import AuthLayout from '../layouts/AuthLayout';
import Icon from '../components/common/Icon';

function ForbiddenPage() {
  const { user } = useAuth();

  return (
    <AuthLayout>
      <div className="text-center">
        <span className="page-header-icon mx-auto mb-3" style={{ background: 'linear-gradient(135deg, #fb7185, #dc2743)' }}>
          <Icon name="lock" size={22} strokeWidth={2} />
        </span>

        <span className="eyebrow">Access restricted</span>
        <h1 className="h3 fw-bold mt-2 mb-2">You do not have access to this area</h1>
        <p className="text-secondary mb-4">
          FloodNet keeps operational responsibilities separate, so each role can only reach the
          tools it is accountable for.
        </p>

        <div className="d-flex flex-column flex-sm-row justify-content-center gap-2">
          {user
            ? (
              <Link className="btn btn-primary" to={roleHomePath(user)}>
                Go to my dashboard
                <Icon name="arrowRight" size={16} />
              </Link>
            )
            : <Link className="btn btn-primary" to="/login">Sign in</Link>}
          <Link className="btn btn-outline-secondary" to="/">Public flood information</Link>
        </div>
      </div>
    </AuthLayout>
  );
}

export default ForbiddenPage;
