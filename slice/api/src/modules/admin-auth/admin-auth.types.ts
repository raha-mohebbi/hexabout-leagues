export type AdminRole = "superadmin" | "admin" | "manager";

export interface AdminIdentity {
  id: string;
  email: string;
  role: AdminRole;
}
