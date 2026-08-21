import Icon from './Icon';

/**
 * The waiting state used while an API request is in flight. The spinner is
 * decorative; the written label is what assistive technology announces.
 */
function LoadingState({ label = 'Loading...' }) {
  return (
    <div className="text-center py-5 fn-anim-in" role="status" aria-live="polite">
      <div className="fn-loader" aria-hidden="true">
        <span className="fn-loader-ring" />
        <span className="fn-loader-ring fn-loader-ring-2" />
        <span className="fn-loader-drop">
          <Icon name="drop" size={20} strokeWidth={2} />
        </span>
      </div>
      <p className="text-secondary mt-3 mb-0 fw-semibold">{label}</p>
    </div>
  );
}

export default LoadingState;
