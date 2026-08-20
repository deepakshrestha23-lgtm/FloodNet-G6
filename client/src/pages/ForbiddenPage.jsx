function ForbiddenPage() {
  return (
    <main className="container py-5">
      <div className="alert alert-warning" role="alert">
        <h1 className="h4">Access restricted</h1>
        <p className="mb-0">Your account does not have permission to view this area.</p>
      </div>
    </main>
  );
}

export default ForbiddenPage;
