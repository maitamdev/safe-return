import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv, isSupabaseConfigured } from "./config";
import {
  getSupabaseAuthStorageKey,
  isJwtTimingError,
  repairJwtTimingSession,
} from "./auth-recovery";

function expireAuthCookies(
  request: NextRequest,
  response: NextResponse,
  storageKey: string | null,
) {
  if (!storageKey) return;
  for (const { name } of request.cookies.getAll()) {
    if (
      name === storageKey ||
      name.startsWith(`${storageKey}.`) ||
      name === `${storageKey}-code-verifier` ||
      name === `${storageKey}-user`
    ) {
      response.cookies.set(name, "", {
        path: "/",
        maxAge: 0,
        sameSite: "lax",
      });
    }
  }
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  if (!isSupabaseConfigured()) {
    return supabaseResponse;
  }

  const { url, anonKey } = getSupabaseEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  let userResult = await supabase.auth.getUser();
  let invalidTimingSession = isJwtTimingError(userResult.error);
  if (invalidTimingSession && (await repairJwtTimingSession(supabase))) {
    userResult = await supabase.auth.getUser();
    invalidTimingSession = isJwtTimingError(userResult.error);
  }
  const user = userResult.data.user;
  const storageKey = getSupabaseAuthStorageKey(url);

  if (invalidTimingSession) {
    expireAuthCookies(request, supabaseResponse, storageKey);
  }

  const path = request.nextUrl.pathname;
  const isProtected =
    path.startsWith("/bounties");
  const isAuthPage =
    path.startsWith("/login") ||
    path.startsWith("/signup") ||
    path.startsWith("/auth") ||
    path.startsWith("/setup");

  if (isProtected && !user) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.searchParams.set("next", path);
    if (invalidTimingSession) {
      redirect.searchParams.set("reason", "session_expired");
    }
    const response = NextResponse.redirect(redirect);
    if (invalidTimingSession) {
      expireAuthCookies(request, response, storageKey);
    }
    return response;
  }

  if (isAuthPage && user && (path === "/login" || path === "/signup")) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/bounties";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  return supabaseResponse;
}
