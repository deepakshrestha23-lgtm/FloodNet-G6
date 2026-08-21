import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../context/FeedbackContext';
import AuthLayout from '../layouts/AuthLayout';
import Icon from '../components/common/Icon';
import GeographySelector, { EMPTY_GEOGRAPHY } from '../components/geography/GeographySelector';

const initialForm = {
  ...EMPTY_GEOGRAPHY,
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: ''
};

function RegisterPage() {
  const { register } = useAuth();
  const { notify } = useFeedback();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (form.password !== form.confirmPassword) {
      notify({
        tone: 'warning',
        title: 'Check the form',
        message: 'The passwords do not match.',
        icon: 'warning'
      });
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
    if (form.wardId) details.homeWardId = form.wardId;

    try {
      await register(details);
      navigate('/login', { replace: true, state: { registered: true } });
    } catch (requestError) {
      notify({
        tone: 'danger',
        title: 'Registration failed',
        message: requestError.details?.join('. ') || requestError.message || 'We could not create your account.',
        icon: 'warning',
        duration: 6000
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout wide>
      <span className="eyebrow">
        <Icon name="user" size={12} strokeWidth={2} />
        Resident registration
      </span>

      <h1 className="h3 fw-bold mt-3 mb-1">Create a resident account</h1>
      <p className="text-secondary">
        Residents can report flooding and follow alerts for their area. Officer and administrator
        accounts are created by a FloodNet administrator.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-4">
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

          <GeographySelector
            value={form}
            onChange={(value) => setForm((current) => ({ ...current, ...value }))}
            required={false}
          />
          <p className="form-text mt-n2 mb-3">
            Setting your ward means alerts and evacuation centres for where you live are shown
            first. You can add or change it later from your profile.
          </p>
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

          <button className="btn btn-primary btn-lg w-100" type="submit" disabled={submitting}>
            {submitting ? 'Creating account...' : 'Create account'}
            {!submitting && <Icon name="arrowRight" size={17} />}
          </button>
        </form>

      <hr className="fn-rule my-4" />

      <p className="text-secondary mb-0">
        Already registered? <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  );
}

export default RegisterPage;
