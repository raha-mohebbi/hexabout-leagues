"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import { useAdmin } from "@/components/admin-shell";
import { clientApi } from "@/lib/client-api";
import { z } from "zod";

const moderationResultSchema = z.object({
  matchId: z.string().uuid(),
  status: z.literal("voided"),
  duplicate: z.boolean(),
});

export default function MatchModeration() {
  const admin = useAdmin();
  const [matchId, setMatchId] = useState("");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (admin.role === "manager") {
    return (
      <div className="state" role="alert">
        <span className="state-icon" aria-hidden="true">!</span>
        <h2>Read-only access</h2>
        <p>Your role does not allow match invalidation.</p>
      </div>
    );
  }

  async function submitInvalidation() {
    if (pending) return;

    setPending(true);
    setError("");
    setSuccess("");

    try {
      const result = await clientApi(
        `/api/matches/${encodeURIComponent(matchId.trim())}/void`,
        moderationResultSchema,
        {
          method: "POST",
          body: JSON.stringify({ reason }),
        }
      );
      setSuccess(
        result.duplicate
          ? "This match result had already been invalidated."
          : "Match result invalidated and recorded in the audit log."
      );
      setMatchId("");
      setReason("");
      setConfirming(false);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to invalidate the match result."
      );
      setConfirming(false);
    } finally {
      setPending(false);
    }
  }

  function continueToConfirmation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const id = z.string().uuid().safeParse(matchId.trim());
    const parsedReason = z.string().trim().min(1).max(2000).safeParse(reason);

    if (!id.success) {
      setError("Enter a valid match result UUID.");
      return;
    }
    if (!parsedReason.success) {
      setError("A reason of 1–2000 characters is required.");
      return;
    }

    setMatchId(id.data);
    setReason(parsedReason.data);
    setConfirming(true);
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Administrative action</p>
          <h1>Match moderation</h1>
          <p className="page-description">
            Invalidate a known match result. This action reverses its score,
            records a compensating event, and creates an audit entry.
          </p>
        </div>
      </div>

      <div className="notice">
        The API does not provide a match-review queue or match-search endpoint.
        Enter a match result ID obtained through an approved operational process.
      </div>
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      {success && <div className="notice" role="status">{success}</div>}

      <section className="panel-card form-card">
        <form className="form-stack" onSubmit={continueToConfirmation}>
          <div className="field">
            <label htmlFor="match-id">Match result ID</label>
            <input
              id="match-id"
              className="input"
              autoComplete="off"
              spellCheck={false}
              placeholder="xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
              value={matchId}
              onChange={(event) => setMatchId(event.target.value)}
              disabled={pending || confirming}
              required
            />
            <p className="form-hint">
              Use the UUID of an existing match result. The API verifies that the result exists.
            </p>
          </div>
          <div className="field">
            <label htmlFor="reason">Reason for invalidation</label>
            <textarea
              id="reason"
              className="textarea"
              minLength={1}
              maxLength={2000}
              placeholder="Describe the evidence or policy basis for this action."
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={pending || confirming}
              required
            />
            <p className="form-hint">{reason.trim().length}/2000 characters</p>
          </div>
          {!confirming ? (
            <button className="button button-danger" type="submit">
              Review invalidation
            </button>
          ) : (
            <div className="confirm-panel" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
              <h2 id="confirm-title">Confirm match invalidation</h2>
              <p>
                This will reverse the awarded score and record an audit entry.
                Review the match ID and reason before continuing.
              </p>
              <p><strong>Match:</strong> {matchId}</p>
              <p><strong>Reason:</strong> {reason}</p>
              <div className="confirm-actions">
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={pending}
                >
                  Cancel
                </button>
                <button
                  className="button button-danger"
                  type="button"
                  onClick={() => void submitInvalidation()}
                  disabled={pending}
                >
                  {pending ? "Submitting…" : "Confirm invalidation"}
                </button>
              </div>
            </div>
          )}
        </form>
      </section>
    </>
  );
}
