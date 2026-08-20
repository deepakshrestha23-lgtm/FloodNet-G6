import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { roleHomePath } from '../routes/roleHome';

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const justRegistered = location.state?.registered === true;

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const signedInUser = await login(form);
      navigate(location.state?.from?.pathname || roleHomePath(signedInUser), { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell d-flex align-items-center justify-content-center px-3 py-5">
      <div className="auth-card panel-card p-4 p-md-5 rounded-4 w-100">
        <Link className="text-decoration-none" to="/">
          <span className="h5 fw-bold">Flood<span className="brand-accent">Net</span></span>
        </Link>

        <h1 className="h3 fw-bold mt-4 mb-1">Sign in</h1>
        <p className="text-secondary">Access your FloodNet reporting and information tools.</p>

        {justRegistered && (
          <div className="alert alert-success" role="alert">
            Your account has been created. Sign in to continue.
          </div>
        )}

        {error && <div className="alert alert-danger" role="alert">{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-3">
            <label className="form-label fw-semibold" htmlFor="login-email">Email address</label>
            <input
              id="login-email"
              className="form-control"
              type="email"
              autoComplete="username"
              required
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </div>

          <div className="mb-4">
            <label className="form-label fw-semibold" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              className="form-control"
              type="password"
              autoComplete="current-password"
              required
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
          </div>

          <button className="btn btn-primary w-100" type="submit" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="text-secondary mt-4 mb-0">
          Need an account? <Link to="/register">Register as a resident</Link>
        </p>
        <p className="text-secondary small mt-2 mb-0">
          <Link to="/">Return to public flood information</Link>
        </p>
      </div>
    </main>
  );
}

export default LoginPage;
