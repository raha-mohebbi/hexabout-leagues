"use client";

import Link from "next/link";

import { useAdmin } from "@/components/admin-shell";

export default function DashboardPage() {
  const admin = useAdmin();
  const canModerate = admin.role !== "manager";

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Operations overview</p>
          <h1>Welcome back</h1>
          <p className="page-description">
            Your workspace for league standings and match-result review.
          </p>
        </div>
      </div>

      <div className="role-banner">
        <span className="role-pill">{admin.role}</span>
        <div>
          <strong>Signed in as {admin.email}</strong>
          <p>
            {canModerate
              ? "You can inspect league standings and invalidate reported match results."
              : "Your account has read-only access to leagues and leaderboard results."}
          </p>
        </div>
      </div>

      <section className="dashboard-grid" aria-label="Admin tools">
        <Link href="/leagues" className="panel-card dashboard-card">
          <div>
            <span className="card-icon" aria-hidden="true">▦</span>
            <h2>League standings</h2>
            <p>Browse leagues and review their current leaderboard positions.</p>
          </div>
          <span className="card-arrow" aria-hidden="true">↗</span>
        </Link>
        {canModerate && (
          <Link href="/matches/moderate" className="panel-card dashboard-card">
            <div>
              <span className="card-icon" aria-hidden="true">◈</span>
              <h2>Match moderation</h2>
              <p>
                Invalidate a reported match with a documented moderation reason.
              </p>
            </div>
            <span className="card-arrow" aria-hidden="true">↗</span>
          </Link>
        )}
      </section>
    </>
  );
}
