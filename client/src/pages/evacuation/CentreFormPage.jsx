import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  createCentre,
  fetchCentre,
  fetchFacilityTypes,
  updateCentre
} from '../../services/centreApi';
import { fetchZones } from '../../services/publicApi';
import { useFeedback } from '../../context/FeedbackContext';
import PageHeader from '../../components/common/PageHeader';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import CoordinateField from '../../components/common/CoordinateField';
import GeographySelector, { EMPTY_GEOGRAPHY } from '../../components/geography/GeographySelector';

function CentreFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  const { notify } = useFeedback();

  const [zones, setZones] = useState([]);
  const [facilityTypes, setFacilityTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentOccupancy, setCurrentOccupancy] = useState(0);

  const [form, setForm] = useState({
    ...EMPTY_GEOGRAPHY,
    zoneId: '',
    locality: '',
    nearestLandmark: '',
    latitude: '',
    longitude: '',
    name: '',
    locationDescription: '',
    contactPhone: '',
    maximumCapacity: '',
    currentOccupancy: '0',
    facilities: {}
  });

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setLoadError(null);

      try {
        const [zonePayload, facilityPayload] = await Promise.all([
          fetchZones(),
          fetchFacilityTypes()
        ]);

        if (!active) return;

        setZones(zonePayload.data.zones);
        setFacilityTypes(facilityPayload.data.facilityTypes);

        if (isEditing) {
          const centrePayload = await fetchCentre(id);
          if (!active) return;

          const centre = centrePayload.data.centre;
          setCurrentOccupancy(centre.currentOccupancy);
          setForm({
            ...EMPTY_GEOGRAPHY,
            provinceId: centre.geography?.province?.id || '',
            districtId: centre.geography?.district?.id || '',
            localLevelId: centre.geography?.localLevel?.id || '',
            wardId: centre.geography?.ward?.id || '',
            zoneId: centre.zone?.id || '',
            locality: centre.locality || '',
            nearestLandmark: centre.nearestLandmark || '',
            latitude: centre.latitude ?? '',
            longitude: centre.longitude ?? '',
            name: centre.name,
            locationDescription: centre.locationDescription,
            contactPhone: centre.contactPhone || '',
            maximumCapacity: String(centre.maximumCapacity),
            currentOccupancy: String(centre.currentOccupancy),
            facilities: Object.fromEntries(
              centre.facilities.map((facility) => [facility.id, facility.notes || ''])
            )
          });
        }
      } catch (caughtError) {
        if (active) setLoadError(caughtError);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [id, isEditing]);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateGeography(value) {
    setForm((current) => ({ ...current, ...value }));
  }

  function toggleFacility(facilityTypeId) {
    setForm((current) => {
      const next = { ...current.facilities };

      if (facilityTypeId in next) {
        delete next[facilityTypeId];
      } else {
        next[facilityTypeId] = '';
      }

      return { ...current, facilities: next };
    });
  }

  function updateFacilityNotes(facilityTypeId, notes) {
    setForm((current) => ({
      ...current,
      facilities: { ...current.facilities, [facilityTypeId]: notes }
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);

    const payload = {
      zoneId: form.zoneId || undefined,
      wardId: form.wardId || undefined,
      locality: form.locality.trim() || undefined,
      nearestLandmark: form.nearestLandmark.trim() || undefined,
      latitude: form.latitude === '' ? undefined : Number(form.latitude),
      longitude: form.longitude === '' ? undefined : Number(form.longitude),
      name: form.name.trim(),
      locationDescription: form.locationDescription.trim(),
      maximumCapacity: Number(form.maximumCapacity),
      facilities: Object.entries(form.facilities).map(([facilityTypeId, notes]) => ({
        facilityTypeId,
        ...(notes.trim() ? { notes: notes.trim() } : {})
      }))
    };

    if (form.contactPhone.trim()) {
      payload.contactPhone = form.contactPhone.trim();
    }

    // Occupancy is only part of the create payload. Afterwards it changes
    // through the dedicated occupancy action so each movement is audited.
    if (!isEditing) {
      payload.currentOccupancy = Number(form.currentOccupancy || 0);
    }

    try {
      if (isEditing) {
        await updateCentre(id, payload);
      } else {
        await createCentre(payload);
      }

      notify({
        tone: 'success',
        title: isEditing ? 'Centre updated' : 'Centre created',
        message: `${payload.name} is ready for evacuation coordination.`,
        icon: 'check'
      });
      navigate('/evacuation/centres');
    } catch (caughtError) {
      notify({
        tone: 'danger',
        title: 'Centre not saved',
        message: caughtError.message || 'We could not save this evacuation centre.',
        icon: 'warning',
        duration: 6000
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingState label="Loading centre form..." />;
  if (loadError) return <ErrorState message={loadError.message} details={loadError.details} />;

  return (
    <div className="page-narrow-wide mx-auto">
      <PageHeader
        eyebrow="Evacuation coordination"
        title={isEditing ? 'Edit evacuation centre' : 'Add evacuation centre'}
        icon="shelter"
        description="Capacity and facility information residents rely on when deciding where to go."
      />

      <form className="panel-card p-3 p-md-4 rounded-4" onSubmit={handleSubmit} noValidate>
        <GeographySelector value={form} onChange={updateGeography} required disabled={false} />
        <div className="row g-3 mb-3">
          <div className="col-12 col-md-6">
            <label className="form-label fw-semibold" htmlFor="centre-zone">Operational risk area <span className="text-secondary fw-normal">(optional)</span></label>
            <select id="centre-zone" className="form-select" value={form.zoneId} onChange={(event) => updateField('zoneId', event.target.value)}>
              <option value="">No operational risk area selected</option>
              {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name} ({zone.code})</option>)}
            </select>
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label fw-semibold" htmlFor="centre-name">Centre name</label>
            <input
              id="centre-name"
              className="form-control"
              required
              minLength={3}
              maxLength={160}
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
            />
          </div>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-12 col-md-6"><label className="form-label fw-semibold" htmlFor="centre-locality">Locality / Tole</label><input id="centre-locality" className="form-control" maxLength={160} value={form.locality} onChange={(event) => updateField('locality', event.target.value)} /></div>
          <div className="col-12 col-md-6"><label className="form-label fw-semibold" htmlFor="centre-landmark">Nearest landmark</label><input id="centre-landmark" className="form-control" maxLength={240} value={form.nearestLandmark} onChange={(event) => updateField('nearestLandmark', event.target.value)} placeholder="Bridge, school, temple or road junction" /></div>
        </div>
        <CoordinateField
          latitude={form.latitude}
          longitude={form.longitude}
          onChange={(value) => setForm((current) => ({ ...current, ...value }))}
          helpText="Helps responders and drivers reach the centre. You can leave this empty."
        />

        <div className="mb-3">
          <label className="form-label fw-semibold" htmlFor="centre-location">Location description</label>
          <textarea
            id="centre-location"
            className="form-control"
            rows={2}
            required
            minLength={3}
            maxLength={500}
            value={form.locationDescription}
            onChange={(event) => updateField('locationDescription', event.target.value)}
            placeholder="Street, landmark and how to reach the entrance"
          />
        </div>

        <div className="row g-3 mb-3">
          <div className="col-12 col-md-4">
            <label className="form-label fw-semibold" htmlFor="centre-phone">Contact phone</label>
            <input
              id="centre-phone"
              className="form-control"
              maxLength={40}
              value={form.contactPhone}
              onChange={(event) => updateField('contactPhone', event.target.value)}
            />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label fw-semibold" htmlFor="centre-capacity">Maximum capacity</label>
            <input
              id="centre-capacity"
              type="number"
              className="form-control"
              required
              min={isEditing ? currentOccupancy : 0}
              value={form.maximumCapacity}
              onChange={(event) => updateField('maximumCapacity', event.target.value)}
            />
            {isEditing && (
              <p className="form-text">
                Cannot be set below the current occupancy of {currentOccupancy}.
              </p>
            )}
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label fw-semibold" htmlFor="centre-occupancy">
              Current occupancy
            </label>
            <input
              id="centre-occupancy"
              type="number"
              className="form-control"
              min={0}
              value={form.currentOccupancy}
              onChange={(event) => updateField('currentOccupancy', event.target.value)}
              disabled={isEditing}
            />
            <p className="form-text">
              {isEditing
                ? 'Updated from the centre list so each change is recorded separately.'
                : 'Available spaces are calculated from capacity and occupancy.'}
            </p>
          </div>
        </div>

        <fieldset className="mb-3">
          <legend className="form-label fw-semibold">Available facilities</legend>
          <div className="row g-2">
            {facilityTypes.map((facilityType) => {
              const selected = facilityType.id in form.facilities;

              return (
                <div className="col-12 col-md-6" key={facilityType.id}>
                  <div className="facility-option p-2 rounded-3 h-100">
                    <div className="form-check">
                      <input
                        id={`facility-${facilityType.id}`}
                        className="form-check-input"
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleFacility(facilityType.id)}
                      />
                      <label className="form-check-label" htmlFor={`facility-${facilityType.id}`}>
                        {facilityType.name}
                      </label>
                    </div>
                    {selected && (
                      <input
                        className="form-control form-control-sm mt-2"
                        placeholder="Notes (optional)"
                        maxLength={300}
                        value={form.facilities[facilityType.id]}
                        onChange={(event) => updateFacilityNotes(facilityType.id, event.target.value)}
                        aria-label={`Notes for ${facilityType.name}`}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </fieldset>

        <div className="d-flex flex-wrap gap-2">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving...' : isEditing ? 'Save changes' : 'Create centre'}
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => navigate('/evacuation/centres')}
            disabled={submitting}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default CentreFormPage;
