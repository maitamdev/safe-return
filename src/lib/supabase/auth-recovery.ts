import type { Session, SupabaseClient, User } from "@supabase/supabase-js";

export const SESSION_REAUTH_REQUIRED_MESSAGE =
  "Phiên đăng nhập cũ không còn hợp lệ. SafeReturn đã làm sạch phiên lỗi; vui lòng đăng nhập lại.";

const activeRepairs = new WeakMap<SupabaseClient, Promise<boolean>>();

export function isJwtTimingError(error: unknown) {
  const message =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
        ? String(error.message)
        : "";

  return /jwt.*(?:issued (?:at|in the) future|not yet valid|not active yet)|(?:issued (?:at|in the) future|not yet valid|not active yet).*jwt/i.test(
    message,
  );
}

export function getSupabaseAuthStorageKey(url: string) {
  try {
    const projectRef = new URL(url).hostname.split(".")[0];
    return projectRef ? `sb-${projectRef}-auth-token` : null;
  } catch {
    return null;
  }
}

export async function repairJwtTimingSession(client: SupabaseClient) {
  const existing = activeRepairs.get(client);
  if (existing) return existing;

  const repair = (async () => {
    try {
      const { data, error } = await client.auth.refreshSession();
      return !error && Boolean(data.session);
    } catch {
      return false;
    }
  })();
  activeRepairs.set(client, repair);

  try {
    return await repair;
  } finally {
    activeRepairs.delete(client);
  }
}

export async function clearInvalidLocalSession(
  client: SupabaseClient,
  storageKey?: string | null,
) {
  try {
    await client.auth.signOut({ scope: "local" });
  } catch {
    // Fall through: a timing-invalid JWT can make signOut fail before the SDK
    // removes its own storage entry.
  }

  if (storageKey) {
    clearBrowserAuthStorage(storageKey);
  }
}

export function clearBrowserAuthStorage(storageKey: string) {
  if (typeof document !== "undefined") {
    const names = document.cookie
      .split(";")
      .map((part) => part.trim().split("=")[0])
      .filter(
        (name) =>
          name === storageKey ||
          name.startsWith(`${storageKey}.`) ||
          name === `${storageKey}-code-verifier` ||
          name === `${storageKey}-user`,
      );

    for (const name of names) {
      document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
    }
  }

  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(storageKey);
    localStorage.removeItem(`${storageKey}-code-verifier`);
    localStorage.removeItem(`${storageKey}-user`);
  }
}

export type ValidatedAuthSession = {
  session: Session;
  user: User;
};

/** Validate cached SSR cookies against Auth and repair only timing-invalid JWTs. */
export async function getValidatedAuthSession(
  client: SupabaseClient,
  storageKey?: string | null,
): Promise<ValidatedAuthSession | null> {
  const sessionResult = await client.auth.getSession();
  const session = sessionResult.data.session;
  if (!session) return null;

  const userResult = await client.auth.getUser();
  if (!userResult.error && userResult.data.user) {
    return { session, user: userResult.data.user };
  }

  if (!isJwtTimingError(userResult.error)) return null;

  const repaired = await repairJwtTimingSession(client);
  if (repaired) {
    const [freshSessionResult, freshUserResult] = await Promise.all([
      client.auth.getSession(),
      client.auth.getUser(),
    ]);
    if (
      freshSessionResult.data.session &&
      !freshUserResult.error &&
      freshUserResult.data.user
    ) {
      return {
        session: freshSessionResult.data.session,
        user: freshUserResult.data.user,
      };
    }
  }

  await clearInvalidLocalSession(client, storageKey);
  return null;
}
