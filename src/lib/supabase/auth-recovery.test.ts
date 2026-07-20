import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  clearBrowserAuthStorage,
  clearInvalidLocalSession,
  getSupabaseAuthStorageKey,
  getValidatedAuthSession,
  isJwtTimingError,
  repairJwtTimingSession,
} from "./auth-recovery";

describe("Supabase JWT recovery", () => {
  it("recognizes clock-invalid JWT errors without matching unrelated failures", () => {
    expect(isJwtTimingError({ message: "JWT issued at future" })).toBe(true);
    expect(isJwtTimingError({ message: "JWT issued in the future" })).toBe(true);
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

  it("does not share a refresh promise between different clients", async () => {
    const firstRefresh = vi.fn().mockResolvedValue({
      data: { session: { access_token: "first" } },
      error: null,
    });
    const secondRefresh = vi.fn().mockResolvedValue({
      data: { session: { access_token: "second" } },
      error: null,
    });
    const first = { auth: { refreshSession: firstRefresh } } as unknown as SupabaseClient;
    const second = { auth: { refreshSession: secondRefresh } } as unknown as SupabaseClient;

    await expect(
      Promise.all([repairJwtTimingSession(first), repairJwtTimingSession(second)]),
    ).resolves.toEqual([true, true]);
    expect(firstRefresh).toHaveBeenCalledOnce();
    expect(secondRefresh).toHaveBeenCalledOnce();
  });

  it("clears only the local session during recovery", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    const client = { auth: { signOut } } as unknown as SupabaseClient;

    await clearInvalidLocalSession(client);
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("derives the same auth storage key as supabase-js", () => {
    expect(getSupabaseAuthStorageKey("https://project-ref.supabase.co")).toBe(
      "sb-project-ref-auth-token",
    );
    expect(getSupabaseAuthStorageKey("not a URL")).toBeNull();
  });

  it("expires chunked SSR auth cookies when SDK sign-out cannot clean them", () => {
    const writes: string[] = [];
    const fakeDocument = {} as Document;
    Object.defineProperty(fakeDocument, "cookie", {
      configurable: true,
      get: () =>
        "theme=dark; sb-demo-auth-token.0=part-a; sb-demo-auth-token.1=part-b",
      set: (value: string) => writes.push(value),
    });
    vi.stubGlobal("document", fakeDocument);

    clearBrowserAuthStorage("sb-demo-auth-token");

    expect(writes).toEqual([
      "sb-demo-auth-token.0=; Path=/; Max-Age=0; SameSite=Lax",
      "sb-demo-auth-token.1=; Path=/; Max-Age=0; SameSite=Lax",
    ]);
    vi.unstubAllGlobals();
  });

  it("refreshes and revalidates a timing-invalid session", async () => {
    const staleSession = { access_token: "stale", user: { id: "user-1" } };
    const freshSession = { access_token: "fresh", user: { id: "user-1" } };
    const getSession = vi
      .fn()
      .mockResolvedValueOnce({ data: { session: staleSession }, error: null })
      .mockResolvedValueOnce({ data: { session: freshSession }, error: null });
    const getUser = vi
      .fn()
      .mockResolvedValueOnce({
        data: { user: null },
        error: { message: "JWT issued at future" },
      })
      .mockResolvedValueOnce({ data: { user: freshSession.user }, error: null });
    const refreshSession = vi.fn().mockResolvedValue({
      data: { session: freshSession },
      error: null,
    });
    const client = {
      auth: { getSession, getUser, refreshSession },
    } as unknown as SupabaseClient;

    await expect(getValidatedAuthSession(client)).resolves.toEqual({
      session: freshSession,
      user: freshSession.user,
    });
    expect(refreshSession).toHaveBeenCalledOnce();
  });

  it("clears an unrecoverable timing-invalid session", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: "stale" } },
          error: null,
        }),
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: "JWT issued at future" },
        }),
        refreshSession: vi.fn().mockResolvedValue({
          data: { session: null },
          error: { message: "JWT issued at future" },
        }),
        signOut,
      },
    } as unknown as SupabaseClient;

    await expect(getValidatedAuthSession(client)).resolves.toBeNull();
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
