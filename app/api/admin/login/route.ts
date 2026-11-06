import { NextResponse } from "next/server";

import { setPreAuthCookie } from "@/lib/admin-cookies";
import {
  clearLoginFailures,
  createPreAuth,
  getAdminPassword,
  getLoginRateLimit,
  hasPasskeys,
  recordLoginFailure,
  verifyAdminPassword,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * 第一因素：管理员口令。
 * 校验通过后签发一个短期 pre-auth cookie，客户端再继续做 passkey（第二因素）验证。
 */
export async function POST(request: Request) {
  const rateLimit = getLoginRateLimit();
  if (rateLimit.limited) {
    return NextResponse.json(
      { error: `口令尝试次数过多，请 ${Math.ceil(rateLimit.retryAfterMs / 60000)} 分钟后再试` },
      {
        status: 429,
        headers: { "retry-after": String(Math.ceil(rateLimit.retryAfterMs / 1000)) },
      },
    );
  }

  if (!getAdminPassword()) {
    return NextResponse.json({ error: "服务器未配置 ADMIN_PASSWORD，管理员功能不可用" }, { status: 503 });
  }

  const payload = (await request.json().catch(() => null)) as { password?: unknown } | null;
  const password = typeof payload?.password === "string" ? payload.password : "";

  if (!verifyAdminPassword(password)) {
    recordLoginFailure();
    return NextResponse.json({ error: "管理员口令不正确" }, { status: 401 });
  }

  clearLoginFailures();

  const preAuthId = createPreAuth();
  const response = NextResponse.json({ ok: true, next: hasPasskeys() ? "passkey" : "register" });
  setPreAuthCookie(response, preAuthId);
  return response;
}
