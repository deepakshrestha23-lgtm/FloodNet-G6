import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../context/FeedbackContext';
import { apiRequest } from '../services/api';
import PageHeader from '../components/common/PageHeader';
import Icon from '../components/common/Icon';
import GeographySelector, { EMPTY_GEOGRAPHY } from '../components/geography/GeographySelector';
import StatusBadge from '../components/common/StatusBadge';
import { ROLE } from '../utils/enums';
import { formatDateTime } from '../utils/formatters';

const EMPTY_PASSWORD_FORM = { currentPassword: '', newPassword: '', confirmPassword: '' };

/**
 * Changing a password requires the current one, so knowing the account is not
 * enough: an unattended signed-in browser cannot be used to take the account
 * over. A successful change signs every other device out.
 */
function PasswordSection() {
  const [form, setForm] = useState(EMPTY_PASSWORD_FORM);
  const [submitting, setSubmitting] = useState(false);
  const { notify } = useFeedback();

  const mismatch = form.confirmPassword.length > 0 && form.newPassword !== form.confirmPassword;

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (mismatch) return;

    setSubmitting(true);

    try {
      await apiRequest('/api/auth/me/password', {
        method: 'PATCH',
        body: { currentPassword: form.currentPassword, newPassword: form.newPassword }
      });
      setForm(EMPTY_PASSWORD_FORM);
      notify({
        tone: 'success',
        title: 'Password changed',
        message: 'Other signed-in devices have been signed out.',
        icon: 'check',
        duration: 6000
      });
    } catch (requestError) {
      notify({
        tone: 'danger',
        title: 'Password not changed',
        message: requestError.message || 'We could not update your password.',
        icon: 'warning',
        duration: 6000
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="panel-card p-3 p-md-4 rounded-4 mt-3" onSubmit={handleSubmit} noValidate>
      <h2 className="h6 fw-bold fn-section-title mb-1">
        <Icon name="shield" size={18} />
        Change password
      </h2>
      <p className="small text-secondary mb-3">
        Use at least 8 characters with uppercase, lowercase and a number. Changing your password
        signs you out on every other device.
      </p>

      <div className="mb-3">
        <label className="form-label fw-semibold" htmlFor="password-current">Current password</label>
        <input
          id="password-current"
          className="form-control"
          type="password"
          autoComplete="current-password"
          required
          value={form.currentPassword}
          onChange={(event) => updateField('currentPassword', event.target.value)}
        />
      </div>

      <div className="row g-3 mb-3">
        <div className="col-12 col-md-6">
          <label className="form-label fw-semibold" htmlFor="password-new">New password</label>
          <input
            id="password-new"
            className="form-control"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
            value={form.newPassword}
            onChange={(event) => updateField('newPassword', event.target.value)}
          />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label fw-semibold" htmlFor="password-confirm">Confirm new password</label>
          <input
            id="password-confirm"
            className={`form-control ${mismatch ? 'is-invalid' : ''}`}
            type="password"
            autoComplete="new-password"
            required
            value={form.confirmPassword}
            onChange={(event) => updateField('confirmPassword', event.target.value)}
          />
          {mismatch && <div className="invalid-feedback">Both new password fields must match.</div>}
        </div>
      </div>

      <button
        className="btn btn-primary"
        type="submit"
        disabled={submitting || mismatch || !form.currentPassword || !form.newPassword}
      >
        {submitting ? 'Changing...' : 'Change password'}
      </button>
    </form>
  );
}

/**
 * Profile management for every signed-in role. A resident's official home ward
 * personalises alerts and local-level centre discovery. Optional operational
 * risk-area references remain in the database only for backward compatibility.
 */
function ProfilePage() {
  const { user, refreshUser } = useAuth();

  const [form, setForm] = useState({
    ...EMPTY_GEOGRAPHY,
    firstName: '',
    lastName: '',
    phone: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const { notify } = useFeedback();

  useEffect(() => {
    if (!user) return;

    // The ward carries its ancestors, so the cascading selector can be
    // repopulated without asking the resident to walk the hierarchy again.
    const homeWard = user.profile?.homeWard;

    setForm({
      firstName: user.profile?.firstName || '',
      lastName: user.profile?.lastName || '',
      phone: user.profile?.phone || '',
      provinceId: homeWard?.province?.id || '',
      districtId: homeWard?.district?.id || '',
      localLevelId: homeWard?.localLevel?.id || '',
      wardId: homeWard?.id || ''
    });
  }, [user]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);

    const body = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone.trim() || null,
      // Preserve any old optional risk-area reference without using it as the
      // resident's location or silently deleting compatibility data.
      homeZoneId: user.profile?.homeZoneId || null,
      homeWardId: form.wardId || null
    };

    try {
      await apiRequest('/api/auth/me', { method: 'PATCH', body });
      await refreshUser();
      notify({
        tone: 'success',
        title: 'Profile saved',
        message: 'Your account details and area preferences are up to date.',
        icon: 'check'
      });
    } catch (requestError) {
      notify({
        tone: 'danger',
        title: 'Profile not saved',
        message: requestError.message || 'We could not save your profile.',
        icon: 'warning',
        duration: 6000
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) return null;

  return (
    <div className="page-narrow-wide mx-auto">
      <PageHeader
        eyebrow="Account"
        title="Your profile"
        icon="user"
        description="Keep your contact details and official home location up to date."
      />

      <div className="row g-3">
        <div className="col-12 col-lg-7">
          <form className="panel-card p-3 p-md-4 rounded-4" onSubmit={handleSubmit} noValidate>
            <div className="row g-3 mb-3">
              <div className="col-12 col-md-6">
                <label className="form-label fw-semibold" htmlFor="profile-first-name">First name</label>
                <input
                  id="profile-first-name"
                  className="form-control"
                  required
                  maxLength={100}
                  value={form.firstName}
                  onChange={(event) => updateField('firstName', event.target.value)}
                />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label fw-semibold" htmlFor="profile-last-name">Last name</label>
                <input
                  id="profile-last-name"
                  className="form-control"
                  required
                  maxLength={100}
                  value={form.lastName}
                  onChange={(event) => updateField('lastName', event.target.value)}
                />
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="profile-phone">Phone</label>
              <input
                id="profile-phone"
                className="form-control"
                maxLength={40}
                value={form.phone}
                onChange={(event) => updateField('phone', event.target.value)}
              />
              <p className="form-text">Used by officers only if they need to clarify a report.</p>
            </div>

            <GeographySelector
              value={form}
              onChange={(value) => { setForm((current) => ({ ...current, ...value })); }}
              required={false}
            />
            <p className="form-text mt-n2 mb-3">
              Your home ward decides which official alerts you see first. Evacuation-centre
              discovery falls back to your local level when GPS is unavailable. Leave it unset
              to browse nationwide.
            </p>

            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save changes'}
            </button>
          </form>

          <PasswordSection />
        </div>

        <div className="col-12 col-lg-5">
          <section className="panel-card p-3 p-md-4">
            <div className="d-flex align-items-center gap-3 mb-4">
              <span className="fn-avatar" style={{ width: '3.2rem', height: '3.2rem', fontSize: '1.05rem' }}>
                {`${user.profile?.firstName?.[0] || ''}${user.profile?.lastName?.[0] || ''}`.toUpperCase() || 'FN'}
              </span>
              <div>
                <p className="fw-bold mb-0">
                  {user.profile?.firstName} {user.profile?.lastName}
                </p>
                <p className="small text-secondary mb-0">FloodNet account</p>
              </div>
            </div>

            <h2 className="h6 fw-bold mb-3">Account</h2>
            <dl className="mb-0">
              <dt className="small text-secondary fw-semibold">Email address</dt>
              <dd className="mb-3 text-break">{user.email}</dd>

              <dt className="small text-secondary fw-semibold">Role</dt>
              <dd className="mb-3"><StatusBadge map={ROLE} value={user.role.code} /></dd>

              <dt className="small text-secondary fw-semibold">Last sign-in</dt>
              <dd className="mb-0">{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'This is your first session'}</dd>
            </dl>

            <hr />

            <p className="small text-secondary mb-0">
              Your email address and role are managed by a FloodNet administrator and cannot be
              changed here.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
