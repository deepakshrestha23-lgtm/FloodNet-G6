import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import { fetchZones } from '../services/publicApi';
import PageHeader from '../components/common/PageHeader';
import ErrorState from '../components/common/ErrorState';
import StatusBadge from '../components/common/StatusBadge';
import { ROLE } from '../utils/enums';
import { formatDateTime } from '../utils/formatters';

/**
 * Profile management for every signed-in role. The home flood zone matters
 * operationally: it is what scopes a resident's alerts and nearby evacuation
 * centres, so it is editable here rather than only at registration.
 */
function ProfilePage() {
  const { user, refreshUser } = useAuth();

  const [zones, setZones] = useState([]);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    homeZoneId: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    if (!user) return;

    setForm({
      firstName: user.profile?.firstName || '',
      lastName: user.profile?.lastName || '',
      phone: user.profile?.phone || '',
      homeZoneId: user.profile?.homeZoneId || ''
    });
  }, [user]);

  useEffect(() => {
    fetchZones()
      .then((payload) => setZones(payload.data.zones))
      .catch(() => setZones([]));
  }, []);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setSavedAt(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSavedAt(null);

    const body = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone.trim() || null,
      homeZoneId: form.homeZoneId || null
    };

    try {
      await apiRequest('/api/auth/me', { method: 'PATCH', body });
      await refreshUser();
      setSavedAt(new Date());
    } catch (requestError) {
      setError(requestError);
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
        description="Keep your contact details and home flood zone up to date."
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

            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="profile-home-zone">Home flood zone</label>
              <select
                id="profile-home-zone"
                className="form-select"
                value={form.homeZoneId}
                onChange={(event) => updateField('homeZoneId', event.target.value)}
              >
                <option value="">Not set</option>
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}{zone.locality ? `, ${zone.locality}` : ''}
                  </option>
                ))}
              </select>
              <p className="form-text">
                Your dashboard shows the alerts and evacuation centres for this zone first.
              </p>
            </div>

            {error && <ErrorState message={error.message} details={error.details} />}

            {savedAt && (
              <div className="alert alert-success py-2 small" role="status">
                Profile saved at {formatDateTime(savedAt)}.
              </div>
            )}

            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save changes'}
            </button>
          </form>
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
