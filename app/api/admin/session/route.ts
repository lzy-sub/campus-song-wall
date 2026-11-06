import { NextResponse } from "next/server";

import { clearSessionCookie, readSessionId } from "@/lib/admin-cookies";
import { destroySession, getSession, hasPasskeys, passkeyCount } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** 当前管理员登录态（会话 cookie 只存随机 id，具体状态在服务端） */
export async function GET() {
  const sessionId = await readSessionId();
  return NextResponse.json(
    {
      authenticated: Boolean(getSession(sessionId)),
      hasPasskey: hasPasskeys(),
      passkeyCount: passkeyCount(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function DELETE() {
  const sessionId = await readSessionId();
  destroySession(sessionId);
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
