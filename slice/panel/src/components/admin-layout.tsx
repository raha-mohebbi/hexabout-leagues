import { Suspense } from "react";
import type { ReactNode } from "react";

import { AdminShell } from "./admin-shell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <main className="state" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <p>Loading administrator workspace…</p>
        </main>
      }
    >
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
