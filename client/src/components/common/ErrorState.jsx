function ErrorState({ message = 'Something went wrong.', details, onRetry }) {
  return (
    <div className="alert alert-danger" role="alert">
      <h2 className="h6 alert-heading">Unable to load this information</h2>
      <p className="mb-2">{message}</p>
      {Array.isArray(details) && details.length > 0 && (
        <ul className="mb-2 small">
          {details.map((detail) => <li key={detail}>{detail}</li>)}
        </ul>
      )}
      {onRetry && (
        <button type="button" className="btn btn-sm btn-outline-danger" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export default ErrorState;
