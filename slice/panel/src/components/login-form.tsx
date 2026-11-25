"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { clientApi } from "@/lib/client-api";
import {
  adminIdentitySchema,
  loginRequestSchema,
} from "@/lib/schemas";
import { z } from "zod";

const loginResultSchema = z.object({
  admin: adminIdentitySchema,
});

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const expired = searchParams.get("expired") === "1";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setError("");
    const validation = loginRequestSchema.safeParse({ email, password });

    if (!validation.success) {
      setError("Enter a valid email address and a password of at least 12 characters.");
      return;
    }

    setPending(true);
    try {
      await clientApi(
        "/api/auth/login",
        loginResultSchema,
        {
          method: "POST",
          body: JSON.stringify(validation.data),
        }
      );
      router.replace("/");
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to sign in. Please try again."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="login-wrap">
      <section className="login-aside" aria-label="About Hexabout Leagues">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">H</span>
          <span>
            <span className="brand-name">Hexabout</span>
            <span className="brand-subtitle">League operations</span>
          </span>
        </div>
        <div className="login-message">
          <p className="eyebrow">Administrator workspace</p>
          <h1>Competition, clearly in view.</h1>
          <p>
            Review league standings and manage reported match results from one
            focused operations workspace.
          </p>
        </div>
        <p className="login-footer">Hexabout Leagues · Internal administration</p>
      </section>
      <section className="login-main">
        <div className="login-form-wrap">
          <p className="eyebrow">Secure access</p>
          <h2>Sign in to your account</h2>
          <p>Use your administrator credentials to continue.</p>
          {expired && (
            <div className="notice" role="status">
              Your session expired. Please sign in again.
            </div>
          )}
          {error && (
            <div className="notice notice-error" role="alert">
              {error}
            </div>
          )}
          <form className="form-stack" onSubmit={submit}>
            <div className="field">
              <label htmlFor="admin-email">Email address</label>
              <input
                id="admin-email"
                className="input"
                type="email"
                autoComplete="username"
                autoCapitalize="none"
                required
                maxLength={255}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={pending}
              />
            </div>
            <div className="field">
              <label htmlFor="admin-password">Password</label>
              <input
                id="admin-password"
                className="input"
                type="password"
                autoComplete="current-password"
                required
                minLength={12}
                maxLength={1024}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={pending}
              />
            </div>
            <button
              className="button button-primary"
              type="submit"
              disabled={pending}
            >
              {pending ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
