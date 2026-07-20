import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  clearInvalidLocalSession,
  isJwtTimingError,
  repairJwtTimingSession,
} from "./auth-recovery";

describe("Supabase JWT recovery", () => {
  it("recognizes clock-invalid JWT errors without matching unrelated failures", () => {
    expect(isJwtTimingError({ message: "JWT issued at future" })).toBe(true);
    expect(isJwtTimingError("JWT is not yet valid")).toBe(true);
    expect(isJwtTimingError({ message: "permission denied for table bounties" })).toBe(false);
  });

  it("reports a successful refresh only when a new session exists", async () => {
    const refreshSession = vi.fn().mockResolvedValue({
      data: { session: { access_token: "fresh" } },
      error: null,
    });
    const client = { auth: { refreshSession } } as unknown as SupabaseClient;

    await expect(repairJwtTimingSession(client)).resolves.toBe(true);
    expect(refreshSession).toHaveBeenCalledOnce();
  });

  it("clears only the local session during recovery", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    const client = { auth: { signOut } } as unknown as SupabaseClient;

    await clearInvalidLocalSession(client);
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
