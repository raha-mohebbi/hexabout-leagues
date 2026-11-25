import { Suspense } from "react";

import LoginForm from "@/components/login-form";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="state" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <p>Loading sign-in…</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
