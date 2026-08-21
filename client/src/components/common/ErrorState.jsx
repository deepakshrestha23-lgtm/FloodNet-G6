import Icon from './Icon';

function ErrorState({ message = 'Something went wrong.', details, onRetry }) {
  return (
    <div className="alert alert-danger d-flex gap-3 align-items-start" role="alert">
      <Icon name="warning" size={22} strokeWidth={2} className="mt-1" />
      <div className="flex-grow-1">
        <h2 className="h6 alert-heading fw-bold">Unable to load this information</h2>
        <p className="mb-2">{message}</p>
        {Array.isArray(details) && details.length > 0 && (
          <ul className="mb-2 small">
            {details.map((detail) => <li key={detail}>{detail}</li>)}
          </ul>
        )}
        {onRetry && (
          <button type="button" className="btn btn-sm btn-outline-danger" onClick={onRetry}>
            <Icon name="refresh" size={15} />
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

export default ErrorState;
