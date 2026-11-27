/**
 * 管理员鉴权（最简单的口令方案）。
 *
 * 读取请求头 `x-admin-password`，与服务端环境变量 `ADMIN_PASSWORD`
 * 对比，相等即通过。返回纯数据结果，由各 API route 自行转换成
 * NextResponse，方便在测试中直接调用。
 */
export type AdminAuth =
  | { ok: true }
  | { ok: false; status: 401 | 500; error: string };

export function checkAdmin(request: Request): AdminAuth {
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  if (!adminPassword) {
    return { ok: false, status: 500, error: "服务端未配置 ADMIN_PASSWORD" };
  }

  const provided = request.headers.get("x-admin-password") ?? "";
  if (provided !== adminPassword) {
    return { ok: false, status: 401, error: "管理员口令错误" };
  }

  return { ok: true };
}
