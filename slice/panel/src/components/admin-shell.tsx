"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

import { clientApi } from "@/lib/client-api";
import type { ClientApiError } from "@/lib/client-api";
import { adminIdentitySchema } from "@/lib/schemas";
import type { AdminIdentity } from "@/lib/schemas";

const AdminContext = createContext<AdminIdentity | null>(null);

export function useAdmin() {
  const admin = useContext(AdminContext);

  if (!admin) {
    throw new Error("useAdmin must be used within AdminShell");
  }

  return admin;
}

function initials(email: string) {
  return email.slice(0, 1).toUpperCase();
}

export function AdminShell({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let active = true;

    void clientApi("/api/auth/session", adminIdentitySchema)
      .then((currentAdmin) => {
        if (active) setAdmin(currentAdmin);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        const apiError = reason as ClientApiError;
        if (apiError.status === 401) {
          router.replace("/login?expired=1");
          return;
        }
        setError(apiError.message || "Unable to verify your session");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    function handleExpiredSession() {
      router.replace("/login?expired=1");
    }

    window.addEventListener("panel:session-expired", handleExpiredSession);
    return () =>
      window.removeEventListener("panel:session-expired", handleExpiredSession);
  }, [router]);

  const navItems = useMemo(() => {
    const items = [
      { href: "/", label: "Overview", icon: "⌂" },
      { href: "/leagues", label: "Leagues", icon: "▦" },
    ];

    if (admin?.role === "admin" || admin?.role === "superadmin") {
      items.push({
        href: "/matches/moderate",
        label: "Match moderation",
        icon: "◈",
      });
    }

    return items;
  }, [admin?.role]);

  async function logout() {
    if (loggingOut) return;

    setLoggingOut(true);
    try {
      await clientApi(
        "/api/auth/logout",
        adminIdentitySchema.nullable(),
        { method: "POST" }
      );
    } catch {
      // The BFF always clears its local cookie, including when upstream logout fails.
    } finally {
      router.replace("/login");
      router.refresh();
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <main className="state" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        <p>Verifying administrator session…</p>
      </main>
    );
  }

  if (error || !admin) {
    return (
      <main className="state" role="alert">
        <span className="state-icon" aria-hidden="true">!</span>
        <h2>We couldn’t verify your access</h2>
        <p>{error || "Your session is no longer available. Please sign in again."}</p>
        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <button
            className="button button-primary"
            onClick={() => {
              setLoading(true);
              setError("");
              void clientApi("/api/auth/session", adminIdentitySchema)
                .then(setAdmin)
                .catch((reason: unknown) => {
                  const apiError = reason as ClientApiError;
                  if (apiError.status === 401) {
                    router.replace("/login?expired=1");
                    return;
                  }
                  setError(
                    apiError.message || "Unable to verify your session"
                  );
                })
                .finally(() => setLoading(false));
            }}
          >
            Try again
          </button>
          <Link className="button button-secondary" href="/login">
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <AdminContext.Provider value={admin}>
      <div className="app-shell">
        <aside className="sidebar">
          <Link href="/" className="brand" aria-label="Hexabout Leagues overview">
            <span className="brand-mark" aria-hidden="true">H</span>
            <span>
              <span className="brand-name">Hexabout</span>
              <span className="brand-subtitle">League operations</span>
            </span>
          </Link>
          <p className="nav-label">Workspace</p>
          <nav className="nav-list" aria-label="Main navigation">
            {navItems.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="nav-link"
                  aria-current={active ? "page" : undefined}
                >
                  <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="sidebar-bottom">
            <p className="sidebar-note">
              Administrative access is enforced by the League API on every
              protected request.
            </p>
          </div>
        </aside>
        <div className="main-column">
          <header className="topbar">
            <div className="admin-chip">
              <span className="avatar" aria-hidden="true">{initials(admin.email)}</span>
              <span className="admin-email">{admin.email}</span>
              <span className="role-pill">{admin.role}</span>
            </div>
            <button
              className="button button-quiet"
              onClick={() => void logout()}
              disabled={loggingOut}
            >
              {loggingOut ? "Signing out…" : "Sign out"}
            </button>
          </header>
          <main className="content">{children}</main>
        </div>
      </div>
    </AdminContext.Provider>
  );
}
