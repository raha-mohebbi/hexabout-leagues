"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { z } from "zod";

import { clientApi } from "@/lib/client-api";
import { leaderboardResponseSchema } from "@/lib/schemas";

type Leaderboard = z.infer<typeof leaderboardResponseSchema>["data"];

export default function LeaderboardView({ leagueId }: { leagueId: string }) {
  const [result, setResult] = useState<{
    leagueId: string;
    entries: Leaderboard | null;
    error: string;
  } | null>(null);
  const loading = result?.leagueId !== leagueId;
  const entries = result?.leagueId === leagueId ? result.entries : null;
  const error = result?.leagueId === leagueId ? result.error : "";

  useEffect(() => {
    let active = true;

    void clientApi(
      `/api/leagues/${encodeURIComponent(leagueId)}/leaderboard`,
      leaderboardResponseSchema.shape.data
    )
      .then((result) => {
        if (active) setResult({ leagueId, entries: result, error: "" });
      })
      .catch((reason: unknown) => {
        if (active) {
          setResult({
            leagueId,
            entries: null,
            error:
              reason instanceof Error
                ? reason.message
                : "Unable to load leaderboard",
          });
        }
      })

    return () => {
      active = false;
    };
  }, [leagueId]);

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            <Link href="/leagues" className="table-link">Leagues</Link>
            {" / "}Leaderboard
          </p>
          <h1>League leaderboard</h1>
          <p className="page-description">
            Current ordered standings for this league. The API returns at most 50 entries.
          </p>
        </div>
        <Link className="button button-secondary" href="/leagues">Back to leagues</Link>
      </div>

      <section className="panel-card table-card" aria-label="Leaderboard">
        <div className="detail-strip">
          <span>League ID <strong>{leagueId}</strong></span>
          <span>Ranking <strong>Score · achievement time · player ID</strong></span>
        </div>
        {error && (
          <div className="state" role="alert">
            <span className="state-icon" aria-hidden="true">!</span>
            <h2>Leaderboard unavailable</h2>
            <p>{error}</p>
          </div>
        )}
        {loading ? (
          <div className="state" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <p>Loading leaderboard…</p>
          </div>
        ) : !error && entries?.length === 0 ? (
          <div className="state">
            <span className="state-icon" aria-hidden="true">◈</span>
            <h2>No players yet</h2>
            <p>This league currently has no leaderboard entries.</p>
          </div>
        ) : !error && entries ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">Player ID</th>
                  <th scope="col">Score</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.playerId}>
                    <td><span className="role-pill">#{entry.rank}</span></td>
                    <td className="table-primary">{entry.playerId}</td>
                    <td><strong>{entry.score}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </>
  );
}
