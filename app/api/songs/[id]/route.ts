import { NextResponse } from "next/server";

import { readSessionId } from "@/lib/admin-cookies";
import { getSession } from "@/lib/auth";
import { hideSong } from "@/lib/songs";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** 管理员隐藏某条点歌（只展示未隐藏内容，所以隐藏后前端刷新列表即可） */
export async function PATCH(_request: Request, context: RouteContext) {
  const sessionId = await readSessionId();
  if (!getSession(sessionId)) {
    return NextResponse.json({ error: "需要管理员登录" }, { status: 401 });
  }

  const { id } = await context.params;
  const song = hideSong(id);
  if (!song) {
    return NextResponse.json({ error: "点歌不存在" }, { status: 404 });
  }

  return NextResponse.json({ song });
}
