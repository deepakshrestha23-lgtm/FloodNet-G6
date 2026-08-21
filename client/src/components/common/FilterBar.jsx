import Icon from './Icon';

/**
 * Renders a responsive row of filter controls from a declarative definition so
 * every list screen filters in a consistent way.
 */
function FilterBar({ filters, values, onChange, onReset }) {
  return (
    <section className="filter-bar p-3 p-md-4 mb-3 fn-anim-up" aria-label="Filters">
      <p className="eyebrow mb-3">
        <Icon name="filter" size={12} strokeWidth={2} />
        Refine
      </p>

      <div className="row g-2 g-md-3 align-items-end">
        {filters.map((filter) => (
          <div className={filter.columnClass || 'col-12 col-sm-6 col-lg-3'} key={filter.name}>
            <label className="form-label small fw-semibold" htmlFor={`filter-${filter.name}`}>
              {filter.label}
            </label>
            {filter.type === 'select' ? (
              <select
                id={`filter-${filter.name}`}
                className="form-select form-select-sm"
                value={values[filter.name] ?? ''}
                onChange={(event) => onChange(filter.name, event.target.value)}
              >
                <option value="">{filter.placeholder || 'All'}</option>
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            ) : (
              <input
                id={`filter-${filter.name}`}
                type={filter.type || 'text'}
                className="form-control form-control-sm"
                placeholder={filter.placeholder}
                value={values[filter.name] ?? ''}
                onChange={(event) => onChange(filter.name, event.target.value)}
              />
            )}
          </div>
        ))}
        {onReset && (
          <div className="col-12 col-sm-auto">
            <button type="button" className="btn btn-outline-secondary btn-sm w-100" onClick={onReset}>
              <Icon name="close" size={14} />
              Clear filters
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

export default FilterBar;
