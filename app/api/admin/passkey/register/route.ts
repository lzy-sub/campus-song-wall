import { NextResponse } from "next/server";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";

import { clearPreAuthCookie, readPreAuthId, setSessionCookie } from "@/lib/admin-cookies";
import {
  addPasskey,
  createSession,
  deletePreAuth,
  getAdminUserHandle,
  getPreAuth,
  hasPasskeys,
  setPreAuthChallenge,
  getPreAuthChallenge,
} from "@/lib/auth";
import { getWebAuthnContext, RP_NAME } from "@/lib/webauthn";

export const dynamic = "force-dynamic";

const PREAUTH_REQUIRED = { error: "请先通过管理员口令验证" } as const;
const ALREADY_REGISTERED = {
  error: "已存在管理员 passkey；当前版本不支持在线追加设备，如需更换设备请重启服务后重新注册",
} as const;

/** 第二因素初始化：生成 passkey 注册参数（仅在还没有任何 passkey 时允许） */
export async function GET(request: Request) {
  const preAuthId = await readPreAuthId();
  if (!preAuthId || !getPreAuth(preAuthId)) {
    return NextResponse.json(PREAUTH_REQUIRED, { status: 401 });
  }
  if (hasPasskeys()) {
    return NextResponse.json(ALREADY_REGISTERED, { status: 409 });
  }

  const { rpID } = getWebAuthnContext(request);
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userID: getAdminUserHandle(),
    userName: "admin",
    userDisplayName: "点歌墙管理员",
    attestationType: "none",
    excludeCredentials: [],
    authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
  });

  // 存下来的必须就是下发给浏览器的那个 challenge，校验时才能对上
  const challenge = setPreAuthChallenge(preAuthId, "registration", options.challenge);
  if (!challenge) {
    return NextResponse.json({ error: "注册挑战创建失败，请重新发起注册" }, { status: 400 });
  }

  return NextResponse.json(options);
}

/** 校验注册结果并落库，随后直接建立管理员会话 */
export async function POST(request: Request) {
  const preAuthId = await readPreAuthId();
  if (!preAuthId || !getPreAuth(preAuthId)) {
    return NextResponse.json(PREAUTH_REQUIRED, { status: 401 });
  }
  if (hasPasskeys()) {
    return NextResponse.json(ALREADY_REGISTERED, { status: 409 });
  }

  const challenge = getPreAuthChallenge(preAuthId, "registration");
  if (!challenge) {
    return NextResponse.json({ error: "注册挑战已过期，请重新发起注册" }, { status: 400 });
  }

  const payload = (await request.json().catch(() => null)) as { response?: unknown } | null;
  if (!payload?.response) {
    return NextResponse.json({ error: "缺少 passkey 注册结果" }, { status: 400 });
  }

  const { rpID, expectedOrigin } = getWebAuthnContext(request);

  try {
    const verification = await verifyRegistrationResponse({
      response: payload.response as RegistrationResponseJSON,
      expectedChallenge: challenge.value,
      expectedOrigin,
      expectedRPID: rpID,
      // 口令已经是第一因素，passkey 只要求「持有设备」这一因素，不强制 UV
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: "passkey 注册校验失败" }, { status: 400 });
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    addPasskey({
      id: credential.id,
      publicKey: isoBase64URL.fromBuffer(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      createdAt: Date.now(),
    });

    deletePreAuth(preAuthId);
    const sessionId = createSession();
    const response = NextResponse.json({ ok: true });
    clearPreAuthCookie(response);
    setSessionCookie(response, sessionId);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json({ error: `passkey 注册失败：${message}` }, { status: 400 });
  }
}
