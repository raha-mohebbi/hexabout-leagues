import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="state">
      <span className="state-icon" aria-hidden="true">!</span>
      <h1>Access not available</h1>
      <p>Your administrator role does not permit this operation.</p>
      <Link className="button button-primary" href="/">Return to overview</Link>
    </main>
  );
}
