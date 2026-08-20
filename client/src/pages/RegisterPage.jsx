import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const initialForm = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: ''
};

function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);

    try {
      await register({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password
      });
      navigate('/login', { replace: true, state: { registered: true } });
    } catch (requestError) {
      setError(requestError.details?.join('. ') || requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="container py-5 page-narrow">
      <div className="card border-0 shadow-sm p-4">
        <span className="eyebrow">FloodNet account</span>
        <h1 className="h3 mt-2">Create a resident account</h1>
        <p className="text-secondary">Your account will start with the Resident role.</p>

        {error && <div className="alert alert-danger" role="alert">{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label" htmlFor="register-first-name">First name</label>
              <input id="register-first-name" className="form-control" required value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="register-last-name">Last name</label>
              <input id="register-last-name" className="form-control" required value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} />
            </div>
          </div>

          <label className="form-label mt-3" htmlFor="register-email">Email address</label>
          <input id="register-email" className="form-control" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />

          <label className="form-label mt-3" htmlFor="register-password">Password</label>
          <input id="register-password" className="form-control" type="password" minLength="8" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          <div className="form-text">Use at least 8 characters with uppercase, lowercase and a number.</div>

          <label className="form-label mt-3" htmlFor="register-confirm-password">Confirm password</label>
          <input id="register-confirm-password" className="form-control mb-4" type="password" required value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} />

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
