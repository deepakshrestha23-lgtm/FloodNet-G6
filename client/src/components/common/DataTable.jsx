import EmptyState from './EmptyState';

/**
 * A responsive table. On narrow screens each row collapses into a stacked card
 * where every cell is labelled by its column heading, so operational data stays
 * readable on a phone during an incident.
 */
function DataTable({
  columns,
  rows,
  rowKey,
  emptyTitle = 'No records found',
  emptyDescription,
  onRowClick,
  caption
}) {
  if (!rows.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="table-responsive-cards">
      <table className="table data-table align-middle mb-0">
        {caption && <caption className="visually-hidden">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={column.headerClass}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={onRowClick ? 'data-table-row-clickable' : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={onRowClick ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onRowClick(row);
                }
              } : undefined}
            >
              {columns.map((column) => (
                <td key={column.key} data-label={column.header} className={column.cellClass}>
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
