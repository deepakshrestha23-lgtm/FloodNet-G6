import { useEffect, useState } from 'react';
import { fetchDistricts, fetchLocalLevels, fetchProvinces, fetchWards } from '../../services/geographyApi';

const EMPTY = { provinceId: '', districtId: '', localLevelId: '', wardId: '' };

/*
 * onLabelsChange is opt in and reports the names behind the selected
 * identifiers. It is deliberately separate from onChange: several forms spread
 * the onChange payload straight into a request body, and adding label fields
 * there would send unknown fields the API correctly rejects.
 */
function GeographySelector({ value = EMPTY, onChange, onLabelsChange, disabled = false, required = true }) {
  const selection = { ...EMPTY, ...value };
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [localLevels, setLocalLevels] = useState([]);
  const [wards, setWards] = useState([]);
  const [loading, setLoading] = useState({ provinces: true, children: false });
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetchProvinces()
      .then((payload) => { if (active) setProvinces(payload.data.provinces); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading((current) => ({ ...current, provinces: false })); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selection.provinceId) {
      setDistricts([]);
      return undefined;
    }
    let active = true;
    setLoading((current) => ({ ...current, children: true }));
    fetchDistricts(selection.provinceId)
      .then((payload) => { if (active) setDistricts(payload.data.districts); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading((current) => ({ ...current, children: false })); });
    return () => { active = false; };
  }, [selection.provinceId]);

  useEffect(() => {
    if (!selection.districtId) {
      setLocalLevels([]);
      return undefined;
    }
    let active = true;
    fetchLocalLevels(selection.districtId)
      .then((payload) => { if (active) setLocalLevels(payload.data.localLevels); })
      .catch((requestError) => { if (active) setError(requestError.message); });
    return () => { active = false; };
  }, [selection.districtId]);

  useEffect(() => {
    if (!selection.localLevelId) {
      setWards([]);
      return undefined;
    }
    let active = true;
    fetchWards(selection.localLevelId)
      .then((payload) => { if (active) setWards(payload.data.wards); })
      .catch((requestError) => { if (active) setError(requestError.message); });
    return () => { active = false; };
  }, [selection.localLevelId]);

  function update(field, nextValue) {
    const next = { ...selection, [field]: nextValue };
    if (field === 'provinceId') Object.assign(next, { districtId: '', localLevelId: '', wardId: '' });
    if (field === 'districtId') Object.assign(next, { localLevelId: '', wardId: '' });
    if (field === 'localLevelId') Object.assign(next, { wardId: '' });
    onChange(next);

    if (onLabelsChange) {
      const nameOf = (list, id) => list.find((item) => item.id === id)?.name || '';
      onLabelsChange({
        provinceLabel: nameOf(provinces, next.provinceId),
        districtLabel: nameOf(districts, next.districtId),
        localLevelLabel: nameOf(localLevels, next.localLevelId),
        wardLabel: nameOf(wards, next.wardId)
      });
    }
  }

  return (
    <fieldset className="border rounded-3 p-3 mb-3">
      <legend className="float-none w-auto px-2 fs-6 fw-semibold mb-0">Administrative location</legend>
      <p className="small text-secondary mb-3">
        Select the official Nepal location so this report can be routed to the correct operational team.
      </p>
      {error && <div className="alert alert-danger py-2 small" role="alert">{error}</div>}
      <div className="row g-3">
        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor="geography-province">Province</label>
          <select id="geography-province" className="form-select" required={required} disabled={disabled || loading.provinces} value={selection.provinceId} onChange={(event) => update('provinceId', event.target.value)}>
            <option value="">Select province</option>
            {provinces.map((province) => <option key={province.id} value={province.id}>{province.name}</option>)}
          </select>
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor="geography-district">District</label>
          <select id="geography-district" className="form-select" required={required} disabled={disabled || !selection.provinceId || loading.children} value={selection.districtId} onChange={(event) => update('districtId', event.target.value)}>
            <option value="">Select district</option>
            {districts.map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}
          </select>
        </div>
        <div className="col-12 col-md-7">
          <label className="form-label" htmlFor="geography-local-level">Local level</label>
          <select id="geography-local-level" className="form-select" required={required} disabled={disabled || !selection.districtId} value={selection.localLevelId} onChange={(event) => update('localLevelId', event.target.value)}>
            <option value="">Select local level</option>
            {localLevels.map((localLevel) => <option key={localLevel.id} value={localLevel.id}>{localLevel.name} ({localLevel.type.replaceAll('_', ' ')})</option>)}
          </select>
        </div>
        <div className="col-12 col-md-5">
          <label className="form-label" htmlFor="geography-ward">Ward</label>
          <select id="geography-ward" className="form-select" required={required} disabled={disabled || !selection.localLevelId} value={selection.wardId} onChange={(event) => update('wardId', event.target.value)}>
            <option value="">Select ward</option>
            {wards.map((ward) => <option key={ward.id} value={ward.id}>{ward.name}</option>)}
          </select>
        </div>
      </div>
    </fieldset>
  );
}

export { EMPTY as EMPTY_GEOGRAPHY };
export default GeographySelector;
