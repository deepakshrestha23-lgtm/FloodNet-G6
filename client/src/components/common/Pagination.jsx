function Pagination({ total, limit, offset, onChange }) {
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  const currentPage = Math.floor(offset / limit) + 1;

  if (total <= limit) return null;

  function goToPage(page) {
    const safePage = Math.min(Math.max(page, 1), totalPages);
    onChange((safePage - 1) * limit);
  }

  return (
    <nav aria-label="Pagination" className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
      <p className="small text-secondary mb-0">
        Showing {offset + 1} to {Math.min(offset + limit, total)} of {total}
      </p>
      <div className="btn-group">
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          Previous
        </button>
        <span className="btn btn-outline-secondary btn-sm disabled">
          Page {currentPage} of {totalPages}
        </span>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          Next
        </button>
      </div>
    </nav>
  );
}

export default Pagination;
