import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/admin";
import { listAudit } from "@/lib/songs";

/**
 * 管理员查看隐藏操作的审计记录。
 *
 * 鉴权与 `PATCH /api/songs/[id]` 一致：读取请求头 `x-admin-password`，
 * 与服务端环境变量 `ADMIN_PASSWORD` 对比。
 */
export async function GET(request: Request) {
  const auth = checkAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  return NextResponse.json({ audit: listAudit() });
}
