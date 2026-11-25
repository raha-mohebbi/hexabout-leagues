import type { ReactNode } from "react";

import AdminLayout from "@/components/admin-layout";

export default function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AdminLayout>{children}</AdminLayout>;
}
