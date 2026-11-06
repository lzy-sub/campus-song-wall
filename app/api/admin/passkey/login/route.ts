import { NextResponse } from "next/server";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";

import { clearPreAuthCookie, readPreAuthId, setSessionCookie } from "@/lib/admin-cookies";
import {
  createSession,
  deletePreAuth,
  findPasskey,
  getPreAuth,
  listPasskeys,
  setPreAuthChallenge,
  getPreAuthChallenge,
  updatePasskeyCounter,
} from "@/lib/auth";
import { getWebAuthnContext } from "@/lib/webauthn";

export const dynamic = "force-dynamic";

const PREAUTH_REQUIRED = { error: "请先通过管理员口令验证" } as const;

/** 第二因素登录：生成 passkey 断言参数 */
export async function GET(request: Request) {
  const preAuthId = await readPreAuthId();
  if (!preAuthId || !getPreAuth(preAuthId)) {
    return NextResponse.json(PREAUTH_REQUIRED, { status: 401 });
  }

  const passkeys = listPasskeys();
  if (!passkeys.length) {
    return NextResponse.json({ error: "尚未注册管理员 passkey，请先完成注册" }, { status: 409 });
  }

  const { rpID } = getWebAuthnContext(request);
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: passkeys.map((passkey) => ({ id: passkey.id, transports: passkey.transports })),
    userVerification: "preferred",
  });

  // 存下来的必须就是下发给浏览器的那个 challenge
  const challenge = setPreAuthChallenge(preAuthId, "authentication", options.challenge);
  if (!challenge) {
    return NextResponse.json({ error: "登录挑战创建失败，请重新发起验证" }, { status: 400 });
  }

  return NextResponse.json(options);
}

/** 校验 passkey 断言，成功则建立管理员会话 */
export async function POST(request: Request) {
  const preAuthId = await readPreAuthId();
  if (!preAuthId || !getPreAuth(preAuthId)) {
    return NextResponse.json(PREAUTH_REQUIRED, { status: 401 });
  }

  const challenge = getPreAuthChallenge(preAuthId, "authentication");
  if (!challenge) {
    return NextResponse.json({ error: "登录挑战已过期，请重新发起验证" }, { status: 400 });
  }

  const payload = (await request.json().catch(() => null)) as { response?: unknown } | null;
  if (!payload?.response) {
    return NextResponse.json({ error: "缺少 passkey 验证结果" }, { status: 400 });
  }

  const authenticationResponse = payload.response as AuthenticationResponseJSON;
  const passkey = findPasskey(authenticationResponse.id);
  if (!passkey) {
    return NextResponse.json({ error: "未知的 passkey，请重新注册" }, { status: 400 });
  }

  const { rpID, expectedOrigin } = getWebAuthnContext(request);

  try {
    const verification = await verifyAuthenticationResponse({
      response: authenticationResponse,
      expectedChallenge: challenge.value,
      expectedOrigin,
      expectedRPID: rpID,
      credential: {
        id: passkey.id,
        publicKey: isoBase64URL.toBuffer(passkey.publicKey),
        counter: passkey.counter,
        transports: passkey.transports,
      },
      // 口令已经是第一因素，这里只校验第二因素（设备持有 + 用户存在）
      requireUserVerification: false,
    });

    if (!verification.verified) {
      return NextResponse.json({ error: "passkey 验证失败" }, { status: 400 });
    }

    updatePasskeyCounter(passkey.id, verification.authenticationInfo.newCounter);

    deletePreAuth(preAuthId);
    const sessionId = createSession();
    const response = NextResponse.json({ ok: true });
    clearPreAuthCookie(response);
    setSessionCookie(response, sessionId);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json({ error: `passkey 验证失败：${message}` }, { status: 400 });
  }
}
