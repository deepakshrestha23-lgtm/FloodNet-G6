import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchZones } from '../services/publicApi';

const initialForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  homeZoneId: '',
  password: '',
  confirmPassword: ''
};

function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [zones, setZones] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchZones()
      .then((payload) => setZones(payload.data.zones))
      .catch(() => setZones([]));
  }, []);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    setSubmitting(true);

    const details = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      password: form.password
    };

    if (form.phone.trim()) details.phone = form.phone.trim();
    if (form.homeZoneId) details.homeZoneId = form.homeZoneId;

    try {
      await register(details);
      navigate('/login', { replace: true, state: { registered: true } });
    } catch (requestError) {
      setError(requestError.details?.join('. ') || requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell d-flex align-items-center justify-content-center px-3 py-5">
      <div className="auth-card auth-card-wide panel-card p-4 p-md-5 rounded-4 w-100">
        <Link className="text-decoration-none" to="/">
          <span className="h5 fw-bold">Flood<span className="brand-accent">Net</span></span>
        </Link>

        <h1 className="h3 fw-bold mt-4 mb-1">Create a resident account</h1>
        <p className="text-secondary">
          Residents can report flooding and follow alerts for their area. Officer and administrator
          accounts are created by a FloodNet administrator.
        </p>

        {error && <div className="alert alert-danger" role="alert">{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="row g-3 mb-3">
            <div className="col-12 col-md-6">
              <label className="form-label fw-semibold" htmlFor="register-first-name">First name</label>
              <input
                id="register-first-name"
                className="form-control"
                autoComplete="given-name"
                required
                maxLength={100}
                value={form.firstName}
                onChange={(event) => updateField('firstName', event.target.value)}
              />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label fw-semibold" htmlFor="register-last-name">Last name</label>
              <input
                id="register-last-name"
                className="form-control"
                autoComplete="family-name"
                required
                maxLength={100}
                value={form.lastName}
                onChange={(event) => updateField('lastName', event.target.value)}
              />
            </div>
          </div>

          <div className="row g-3 mb-3">
            <div className="col-12 col-md-6">
              <label className="form-label fw-semibold" htmlFor="register-email">Email address</label>
              <input
                id="register-email"
                className="form-control"
                type="email"
                autoComplete="username"
                required
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
              />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label fw-semibold" htmlFor="register-phone">Phone (optional)</label>
              <input
                id="register-phone"
                className="form-control"
                autoComplete="tel"
                maxLength={40}
                value={form.phone}
                onChange={(event) => updateField('phone', event.target.value)}
              />
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label fw-semibold" htmlFor="register-home-zone">Home flood zone (optional)</label>
            <select
              id="register-home-zone"
              className="form-select"
              value={form.homeZoneId}
              onChange={(event) => updateField('homeZoneId', event.target.value)}
            >
              <option value="">Not set</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}{zone.locality ? ` — ${zone.locality}` : ''}
                </option>
              ))}
            </select>
            <p className="form-text">
              Setting this shows the alerts and evacuation centres for your area first. You can
              change it later from your profile.
            </p>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-12 col-md-6">
              <label className="form-label fw-semibold" htmlFor="register-password">Password</label>
              <input
                id="register-password"
                className="form-control"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={form.password}
                onChange={(event) => updateField('password', event.target.value)}
              />
              <p className="form-text">At least 8 characters with upper case, lower case and a number.</p>
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label fw-semibold" htmlFor="register-confirm-password">Confirm password</label>
              <input
                id="register-confirm-password"
                className="form-control"
                type="password"
                autoComplete="new-password"
                required
                value={form.confirmPassword}
                onChange={(event) => updateField('confirmPassword', event.target.value)}
              />
            </div>
          </div>

          <button className="btn btn-primary w-100" type="submit" disabled={submitting}>
            {submitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="text-secondary mt-4 mb-0">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </main>
  );
}

export default RegisterPage;
