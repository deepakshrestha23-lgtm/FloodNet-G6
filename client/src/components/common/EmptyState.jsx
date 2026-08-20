function EmptyState({ title = 'Nothing to show yet', description, action }) {
  return (
    <div className="empty-state text-center p-4 p-md-5">
      <h2 className="h6 fw-semibold mb-2">{title}</h2>
      {description && <p className="text-secondary mb-3">{description}</p>}
      {action}
    </div>
  );
}

export default EmptyState;
