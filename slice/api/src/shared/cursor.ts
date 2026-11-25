import { z } from "zod";

const cursorSchema = z.object({
  createdAt: z.string().datetime(),
  id: z.string().uuid(),
});

export interface CursorValue {
  createdAt: string;
  id: string;
}

export function encodeCursor(value: CursorValue): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function decodeCursor(value: string): CursorValue | null {
  try {
    const decoded = Buffer.from(value, "base64url");

    if (decoded.toString("base64url") !== value) {
      return null;
    }

    const result = cursorSchema.safeParse(
      JSON.parse(decoded.toString("utf8"))
    );

    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
