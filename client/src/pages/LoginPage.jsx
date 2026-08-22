import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../context/FeedbackContext';
import { roleHomePath } from '../routes/roleHome';
import AuthLayout from '../layouts/AuthLayout';
import Icon from '../components/common/Icon';

function LoginPage() {
  const { login } = useAuth();
  const { notify } = useFeedback();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const justRegistered = location.state?.registered === true;

  useEffect(() => {
    if (justRegistered) {
      notify({
        tone: 'success',
        title: 'Account created',
        message: 'Your resident account is ready. Sign in to continue.',
        icon: 'check'
      });
    }
  }, [justRegistered, notify]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);

    try {
      const signedInUser = await login(form);
      navigate(location.state?.from?.pathname || roleHomePath(signedInUser), { replace: true });
    } catch (requestError) {
      notify({
        tone: 'danger',
        title: 'Sign-in failed',
        message: requestError.message || 'Check your credentials and try again.',
        icon: 'warning',
        duration: 6000
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <span className="eyebrow">
        <Icon name="lock" size={12} strokeWidth={2} />
        Secure sign in
      </span>

      <h1 className="h3 fw-bold mt-3 mb-1">Welcome back</h1>
      <p className="text-secondary">Access your FloodNet reporting and information tools.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-4">
        <div className="mb-3">
          <label className="form-label fw-semibold" htmlFor="login-email">Email address</label>
          <input
            id="login-email"
            className="form-control"
            type="email"
            autoComplete="username"
            placeholder="you@example.com"
            required
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
        </div>

        <div className="mb-4">
          <label className="form-label fw-semibold" htmlFor="login-password">Password</label>
          <div className="password-control">
            <input
              id="login-password"
              className="form-control password-control-input"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              required
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
            <button
              type="button"
              className="password-toggle"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              <Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} />
            </button>
          </div>
        </div>

        <button className="btn btn-primary btn-lg w-100" type="submit" disabled={submitting}>
          {submitting ? 'Signing in...' : 'Sign in'}
          {!submitting && <Icon name="arrowRight" size={17} />}
        </button>
      </form>

      <hr className="fn-rule my-4" />

      <p className="text-secondary mb-1">
        Need an account? <Link to="/register">Register as a resident</Link>
      </p>
      <p className="text-secondary small mb-0">
        <Link to="/">Return to public flood information</Link>
      </p>
    </AuthLayout>
  );
}

export default LoginPage;
