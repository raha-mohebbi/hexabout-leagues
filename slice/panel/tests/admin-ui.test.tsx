import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminShell from "@/components/admin-layout";
import LoginForm from "@/components/login-form";
import LeagueListView from "@/components/league-list";
import LeaderboardView from "@/components/leaderboard-view";
import MatchModeration from "@/components/match-moderation";
import { clientApi } from "@/lib/client-api";
import { setSearchParams } from "./setup";

vi.mock("@/lib/client-api", () => ({
  clientApi: vi.fn(),
}));

const api = vi.mocked(clientApi);
const admin = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "admin@example.com",
  role: "admin" as const,
};
const league = {
  id: "22222222-2222-4222-8222-222222222222",
  periodId: "33333333-3333-4333-8333-333333333333",
  name: "Spring League",
  tier: "gold",
  createdAt: "2025-01-01T00:00:00.000Z",
};

beforeEach(() => {
  api.mockReset();
});

describe("administrator UI", () => {
  it("shows expired-session notice on the login page", () => {
    setSearchParams(new URLSearchParams("expired=1"));

    render(<LoginForm />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Your session expired"
    );
  });

  it("prevents invalid login submissions from reaching the BFF", async () => {
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "invalid" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "short" },
    });
    fireEvent.submit(screen.getByLabelText("Email address").closest("form")!);

    expect(
      await screen.findByText(/Enter a valid email address/)
    ).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
  });

  it("loads league listings and renders navigation to a leaderboard", async () => {
    api.mockResolvedValue({
      items: [league],
      nextCursor: null,
    });

    render(<LeagueListView />);

    expect(await screen.findByText("Spring League")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View Spring League leaderboard" })
    ).toHaveAttribute("href", `/leagues/${league.id}`);
    expect(api).toHaveBeenCalledWith(
      "/api/leagues?limit=20",
      expect.anything()
    );
  });

  it("renders a clear empty state for a league with no players", async () => {
    api.mockResolvedValue([]);

    render(<LeaderboardView leagueId={league.id} />);

    expect(await screen.findByText("No players yet")).toBeInTheDocument();
  });

  it("renders the leaderboard's rank, player ID, and score", async () => {
    api.mockResolvedValue([
      {
        rank: 1,
        playerId: "44444444-4444-4444-8444-444444444444",
        score: 17,
      },
    ]);

    render(<LeaderboardView leagueId={league.id} />);

    expect(await screen.findByText("#1")).toBeInTheDocument();
    expect(
      screen.getByText("44444444-4444-4444-8444-444444444444")
    ).toBeInTheDocument();
    expect(screen.getByText("17")).toBeInTheDocument();
  });

  it("requires review confirmation before invalidating and blocks duplicate submission", async () => {
    let finishRequest: (() => void) | undefined;
    api.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishRequest = () =>
            resolve({
              matchId: "55555555-5555-4555-8555-555555555555",
              status: "voided",
              duplicate: false,
            });
        })
    );
    api.mockResolvedValueOnce(admin);

    render(
      <AdminShell>
        <MatchModeration />
      </AdminShell>
    );
    await screen.findByRole("button", { name: "Sign out" });

    fireEvent.change(screen.getByLabelText("Match result ID"), {
      target: { value: "55555555-5555-4555-8555-555555555555" },
    });
    fireEvent.change(screen.getByLabelText("Reason for invalidation"), {
      target: { value: "Duplicate match result" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Review invalidation" })
    );

    const confirmButton = screen.getByRole("button", {
      name: "Confirm invalidation",
    });
    expect(api).toHaveBeenCalledTimes(1);
    fireEvent.click(confirmButton);
    await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
    expect(confirmButton).toBeDisabled();

    finishRequest?.();
    expect(
      await screen.findByText(/Match result invalidated/)
    ).toBeInTheDocument();
  });

  it("keeps manager accounts in read-only mode", async () => {
    api.mockResolvedValue({
      ...admin,
      role: "manager",
    });

    render(
      <AdminShell>
        <MatchModeration />
      </AdminShell>
    );

    expect(
      await screen.findByText("Your role does not allow match invalidation.")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Review invalidation" })
    ).not.toBeInTheDocument();
  });
});
