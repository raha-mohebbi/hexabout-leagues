"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { clientApi } from "@/lib/client-api";
import { leagueListResponseSchema } from "@/lib/schemas";
import type { z } from "zod";

type LeagueList = z.infer<typeof leagueListResponseSchema>["data"];

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(value));
}

export default function LeagueListView() {
  const [data, setData] = useState<LeagueList | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [previousCursors, setPreviousCursors] = useState<Array<string | null>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchPage = useCallback((nextCursor: string | null) => {
    const query = new URLSearchParams({ limit: "20" });
    if (nextCursor) query.set("cursor", nextCursor);
    return clientApi(
      `/api/leagues?${query.toString()}`,
      leagueListResponseSchema.shape.data
    );
  }, []);

  useEffect(() => {
    let active = true;

    void fetchPage(null)
      .then((result) => {
        if (!active) return;
        setCursor(null);
        setData(result);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(
          reason instanceof Error ? reason.message : "Unable to load leagues"
        );
        setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fetchPage]);

  function loadPage(nextCursor: string | null) {
    setLoading(true);
    setError("");
    void fetchPage(nextCursor)
      .then((result) => {
        setCursor(nextCursor);
        setData(result);
      })
      .catch((reason: unknown) => {
        setError(
          reason instanceof Error ? reason.message : "Unable to load leagues"
        );
        setData(null);
      })
      .finally(() => setLoading(false));
  }

  function nextPage() {
    if (!data?.nextCursor || loading) return;
    setPreviousCursors((pages) => [...pages, cursor]);
    loadPage(data.nextCursor);
  }

  function previousPage() {
    if (previousCursors.length === 0 || loading) return;
    const previous = previousCursors.at(-1) ?? null;
    setPreviousCursors((pages) => pages.slice(0, -1));
    loadPage(previous);
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Competition management</p>
          <h1>Leagues</h1>
          <p className="page-description">
            Browse league groups and open a leaderboard to inspect current standings.
          </p>
        </div>
      </div>

      {error && (
        <div className="notice notice-error" role="alert">
          <div>{error}</div>
          <button
            className="button button-quiet"
            onClick={() => loadPage(cursor)}
            disabled={loading}
          >
            Try again
          </button>
        </div>
      )}

      <section className="panel-card table-card" aria-label="League list">
        {loading ? (
          <div className="state" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <p>Loading leagues…</p>
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="state">
            <span className="state-icon" aria-hidden="true">▦</span>
            <h2>No leagues to show</h2>
            <p>There are no league records available for this page.</p>
          </div>
        ) : (
          <>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">League</th>
                    <th scope="col">Tier</th>
                    <th scope="col">Competition period</th>
                    <th scope="col">Created</th>
                    <th scope="col"><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((league) => (
                    <tr key={league.id}>
                      <td>
                        <span className="table-primary">{league.name}</span>
                        <span className="table-secondary">{league.id}</span>
                      </td>
                      <td><span className="role-pill">{league.tier}</span></td>
                      <td>{league.periodId}</td>
                      <td>{formatDate(league.createdAt)}</td>
                      <td>
                        <Link
                          className="table-link"
                          href={`/leagues/${league.id}`}
                          aria-label={`View ${league.name} leaderboard`}
                        >
                          View standings <span aria-hidden="true">→</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span className="pagination-label">
                {previousCursors.length > 0 ? "More league results" : "League results"}
              </span>
              <div className="pagination-actions">
                <button
                  className="button button-secondary"
                  onClick={previousPage}
                  disabled={previousCursors.length === 0 || loading}
                >
                  Previous
                </button>
                <button
                  className="button button-secondary"
                  onClick={nextPage}
                  disabled={!data.nextCursor || loading}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </>
  );
}
