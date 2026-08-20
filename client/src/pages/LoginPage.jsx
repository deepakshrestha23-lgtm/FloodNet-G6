import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await login(form);
      navigate(location.state?.from?.pathname || '/dashboard', { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="container py-5 page-narrow">
      <div className="card border-0 shadow-sm p-4">
        <span className="eyebrow">FloodNet account</span>
        <h1 className="h3 mt-2">Sign in</h1>
        <p className="text-secondary">Access your FloodNet information and reporting tools.</p>

        {error && <div className="alert alert-danger" role="alert">{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <label className="form-label" htmlFor="login-email">Email address</label>
          <input
            id="login-email"
            className="form-control mb-3"
            type="email"
            required
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />

          <label className="form-label" htmlFor="login-password">Password</label>
          <input
            id="login-password"
            className="form-control mb-4"
            type="password"
            required
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
          />

          <button className="btn btn-primary w-100" type="submit" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="text-secondary mt-4 mb-0">
          Need an account? <Link to="/register">Register as a resident</Link>
        </p>
      </div>
    </main>
  );
}

export default LoginPage;
