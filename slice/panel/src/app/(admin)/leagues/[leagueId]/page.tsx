"use client";

import { useParams } from "next/navigation";

import LeaderboardView from "@/components/leaderboard-view";

export default function LeagueLeaderboardPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  return <LeaderboardView leagueId={leagueId} />;
}
