/**
 * WebAuthn 运行参数推导。
 *
 * passkey 的 RP ID 必须是当前站点的域名（不含端口），origin 必须与浏览器实际访问的
 * origin 完全一致。默认直接从请求头推导，部署到非标准域名/端口时可以用环境变量覆盖：
 *
 *   WEBAUTHN_RP_ID=example.com
 *   WEBAUTHN_ORIGIN=https://example.com
 */

export const RP_NAME = "校园点歌墙";

export type WebAuthnContext = {
  rpID: string;
  expectedOrigin: string;
};

function firstHeaderValue(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first ? first : null;
}

export function getWebAuthnContext(request: Request): WebAuthnContext {
  const url = new URL(request.url);
  const forwardedProto = firstHeaderValue(request.headers.get("x-forwarded-proto"));
  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"));
  const fallbackOrigin = `${forwardedProto ?? url.protocol.replace(":", "")}://${forwardedHost ?? request.headers.get("host") ?? url.host}`;
  const originCandidate = process.env.WEBAUTHN_ORIGIN?.trim() || request.headers.get("origin") || fallbackOrigin;

  let expectedOrigin: string;
  try {
    expectedOrigin = new URL(originCandidate).origin;
  } catch {
    expectedOrigin = url.origin;
  }

  const rpID = process.env.WEBAUTHN_RP_ID?.trim() || new URL(expectedOrigin).hostname;

  return { rpID, expectedOrigin };
}
