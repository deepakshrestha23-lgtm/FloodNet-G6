function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="page-header d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 className="h3 fw-bold mb-1 mt-1">{title}</h1>
        {description && <p className="text-secondary mb-0">{description}</p>}
      </div>
      {actions && <div className="d-flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export default PageHeader;
