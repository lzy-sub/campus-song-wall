import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

import { PREAUTH_COOKIE, PREAUTH_TTL_MS, SESSION_COOKIE, SESSION_TTL_MS } from "@/lib/auth";

const secureCookies = process.env.NODE_ENV === "production";

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: secureCookies,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export async function readPreAuthId(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(PREAUTH_COOKIE)?.value;
}

export async function readSessionId(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value;
}

export function setPreAuthCookie(response: NextResponse, id: string): void {
  response.cookies.set(PREAUTH_COOKIE, id, cookieOptions(Math.floor(PREAUTH_TTL_MS / 1000)));
}

export function clearPreAuthCookie(response: NextResponse): void {
  response.cookies.set(PREAUTH_COOKIE, "", cookieOptions(0));
}

export function setSessionCookie(response: NextResponse, id: string): void {
  response.cookies.set(SESSION_COOKIE, id, cookieOptions(Math.floor(SESSION_TTL_MS / 1000)));
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", cookieOptions(0));
}
