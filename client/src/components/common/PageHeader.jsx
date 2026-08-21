import Icon from './Icon';

/**
 * The banner at the top of every signed-in screen. The optional icon gives each
 * area a consistent visual anchor; the written title remains the accessible
 * name of the page.
 */
function PageHeader({ eyebrow, title, description, actions, icon = 'wave' }) {
  return (
    <header className="page-header">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
        <div className="d-flex gap-3 align-items-start">
          {icon && (
            <span className="page-header-icon d-none d-sm-grid">
              <Icon name={icon} size={22} strokeWidth={1.9} />
            </span>
          )}
          <div>
            {eyebrow && (
              <span className="eyebrow">
                <Icon name="spark" size={12} strokeWidth={2} />
                {eyebrow}
              </span>
            )}
            <h1 className="h3 fw-bold mb-1 mt-1">{title}</h1>
            {description && <p className="text-secondary mb-0">{description}</p>}
          </div>
        </div>
        {actions && <div className="d-flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export default PageHeader;
