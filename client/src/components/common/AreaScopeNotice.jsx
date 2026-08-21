import Icon from './Icon';

/**
 * States plainly which area a list has been narrowed to, and offers a way out.
 *
 * Silence here is unsafe. A resident scoped to their home ward who is shown a
 * bare "no active alerts" cannot tell that apart from "nothing is happening
 * anywhere", and in a flood warning system that is the failure that gets
 * someone hurt. Whenever a scope is applied, this says so, reports how many
 * records exist outside it, and gives one click to see everything.
 */
function AreaScopeNotice({ areaLabel, shownCount, totalCount, onShowAll, noun = 'alert' }) {
  if (!areaLabel) return null;

  const elsewhere = Math.max(0, (totalCount ?? 0) - shownCount);
  const plural = elsewhere === 1 ? noun : `${noun}s`;

  return (
    <div className="fn-scope-notice d-flex flex-wrap align-items-center gap-2 mb-3" role="status">
      <Icon name="pin" size={16} />
      <span className="small">
        Showing <strong>{areaLabel}</strong>.
        {elsewhere > 0
          ? <> {elsewhere} more active {plural} {elsewhere === 1 ? 'is' : 'are'} in effect elsewhere in Nepal.</>
          : <> Nothing further is in effect elsewhere in Nepal.</>}
      </span>
      {onShowAll && (
        <button type="button" className="btn btn-sm btn-outline-primary ms-auto" onClick={onShowAll}>
          Show all of Nepal
        </button>
      )}
    </div>
  );
}

export default AreaScopeNotice;
