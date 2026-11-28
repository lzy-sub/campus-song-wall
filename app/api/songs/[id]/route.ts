import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/admin";
import { hideSong } from "@/lib/songs";

/**
 * 管理员隐藏点歌。
 *
 * 鉴权：读取请求头 `x-admin-password`，与服务端环境变量 `ADMIN_PASSWORD`
 * 对比（相等即通过）。这是 README 里「最简单的管理员口令」方案。
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = checkAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  const song = hideSong(id);
  if (!song) {
    return NextResponse.json({ error: "点歌不存在" }, { status: 404 });
  }

  return NextResponse.json({ song });
}
