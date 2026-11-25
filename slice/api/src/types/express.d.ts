import type { AdminRole } from "../modules/admin-auth/admin-auth.types.js";
import type { PlayerPrincipal } from "../modules/player-auth/player-auth.js";

declare global {
  namespace Express {
    interface Request {
      admin?: {
        id: string;
        email: string;
        role: AdminRole;
      };
      player?: PlayerPrincipal;
    }
  }
}

export {};
