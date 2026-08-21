import Icon from './Icon';

const TONE_META = {
  success: { icon: 'check', label: 'Success' },
  danger: { icon: 'warning', label: 'Error' },
  warning: { icon: 'warning', label: 'Warning' },
  info: { icon: 'spark', label: 'Information' }
};

function FeedbackViewport({ items, onDismiss }) {
  return (
    <div className="fn-feedback-viewport" aria-label="Action feedback">
      {items.map((item) => {
        const meta = TONE_META[item.tone] || TONE_META.info;
        const liveRole = item.tone === 'danger' || item.tone === 'warning' ? 'alert' : 'status';

        return (
          <div
            className={`fn-feedback-chip fn-feedback-chip-${item.tone}`}
            key={item.id}
            role={liveRole}
          >
            <span className="fn-feedback-chip-icon" aria-hidden="true">
              <Icon name={item.icon || meta.icon} size={17} strokeWidth={2.2} />
            </span>
            <span className="fn-feedback-chip-copy">
              <span className="visually-hidden">{meta.label}: </span>
              {item.title && <strong className="fn-feedback-chip-title">{item.title}</strong>}
              {item.message && <span className="fn-feedback-chip-message">{item.message}</span>}
            </span>
            <button
              type="button"
              className="fn-feedback-chip-close"
              aria-label="Dismiss message"
              onClick={() => onDismiss(item.id)}
            >
              <Icon name="close" size={15} strokeWidth={2.2} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default FeedbackViewport;
