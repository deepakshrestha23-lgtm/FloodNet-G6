import { useEffect, useState } from 'react';
import { fetchDistricts, fetchLocalLevels, fetchProvinces, fetchWards } from '../../services/geographyApi';
import Icon from '../common/Icon';

/**
 * Narrows a list by Nepal's administrative hierarchy.
 *
 * People locate themselves the way the country is actually organised: a
 * province, a district, a municipality, a ward. They do not know which internal
 * operational area a place belongs to, so that is not what they are asked for.
 *
 * Every level is optional and filtering applies at whatever depth is reached.
 * Choosing a district returns everything inside it, which is the common case:
 * someone wants shelter in Chitwan, not in ward 11 specifically. Selecting a
 * level clears the levels beneath it, so the query can never describe a place
 * that does not exist.
 */

const EMPTY = { provinceId: '', districtId: '', localLevelId: '', wardId: '' };

function LocationFilter({ value = EMPTY, onChange, labelPrefix = 'Location' }) {
  const selection = { ...EMPTY, ...value };
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [localLevels, setLocalLevels] = useState([]);
  const [wards, setWards] = useState([]);

  useEffect(() => {
    let active = true;
    fetchProvinces()
      .then((payload) => { if (active) setProvinces(payload.data.provinces); })
      .catch(() => { if (active) setProvinces([]); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selection.provinceId) { setDistricts([]); return undefined; }
    let active = true;
    fetchDistricts(selection.provinceId)
      .then((payload) => { if (active) setDistricts(payload.data.districts); })
      .catch(() => { if (active) setDistricts([]); });
    return () => { active = false; };
  }, [selection.provinceId]);

  useEffect(() => {
    if (!selection.districtId) { setLocalLevels([]); return undefined; }
    let active = true;
    fetchLocalLevels(selection.districtId)
      .then((payload) => { if (active) setLocalLevels(payload.data.localLevels); })
      .catch(() => { if (active) setLocalLevels([]); });
    return () => { active = false; };
  }, [selection.districtId]);

  useEffect(() => {
    if (!selection.localLevelId) { setWards([]); return undefined; }
    let active = true;
    fetchWards(selection.localLevelId)
      .then((payload) => { if (active) setWards(payload.data.wards); })
      .catch(() => { if (active) setWards([]); });
    return () => { active = false; };
  }, [selection.localLevelId]);

  function update(field, nextValue) {
    const next = { ...selection, [field]: nextValue };
    // Narrower levels cannot survive a change above them.
    if (field === 'provinceId') Object.assign(next, { districtId: '', localLevelId: '', wardId: '' });
    if (field === 'districtId') Object.assign(next, { localLevelId: '', wardId: '' });
    if (field === 'localLevelId') Object.assign(next, { wardId: '' });
    onChange(next);
  }

  const levels = [
    {
      name: 'provinceId',
      label: 'Province',
      all: 'All of Nepal',
      options: provinces.map((p) => ({ value: p.id, label: p.name })),
      disabled: provinces.length === 0
    },
    {
      name: 'districtId',
      label: 'District',
      all: 'All districts',
      options: districts.map((d) => ({ value: d.id, label: d.name })),
      disabled: !selection.provinceId
    },
    {
      name: 'localLevelId',
      label: 'Municipality',
      all: 'All municipalities',
      options: localLevels.map((l) => ({ value: l.id, label: l.name })),
      disabled: !selection.districtId
    },
    {
      name: 'wardId',
      label: 'Ward',
      all: 'All wards',
      options: wards.map((w) => ({ value: w.id, label: w.name })),
      disabled: !selection.localLevelId
    }
  ];

  return (
    <div>
      <p className="eyebrow mb-2">
        <Icon name="pin" size={12} strokeWidth={2} />
        {labelPrefix}
      </p>
      <div className="row g-2">
        {levels.map((level) => (
          <div className="col-6 col-lg-3" key={level.name}>
            <label className="form-label small fw-semibold" htmlFor={`location-${level.name}`}>
              {level.label}
            </label>
            <select
              id={`location-${level.name}`}
              className="form-select form-select-sm"
              value={selection[level.name]}
              disabled={level.disabled}
              onChange={(event) => update(level.name, event.target.value)}
            >
              <option value="">{level.all}</option>
              {level.options.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

export { EMPTY as EMPTY_LOCATION };
export default LocationFilter;
