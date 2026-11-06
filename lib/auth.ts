import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * 管理员 2FA 服务端状态。
 *
 * 第一因素：ADMIN_PASSWORD 口令（环境变量）。
 * 第二因素：WebAuthn passkey（注册一次后，每次登录都要做一次断言）。
 *
 * 说明：和 `lib/songs.ts` 一样，这里的数据只存在进程内存里，重启即失效——
 * passkey 凭据、会话、挑战都会清空，重启后管理员需要重新走一遍「口令 + 注册 passkey」。
 * 这对新手示例项目足够了；要做成持久化，可以把这些状态落到数据库里。
 */

export const SESSION_COOKIE = "csw_admin_session";
export const PREAUTH_COOKIE = "csw_admin_preauth";

/** 登录态有效期：8 小时 */
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
/** 口令通过后，完成 passkey 验证的时间窗口：5 分钟 */
export const PREAUTH_TTL_MS = 5 * 60 * 1000;
/** WebAuthn 挑战有效期：5 分钟 */
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
/** 口令失败限流窗口 */
export const LOGIN_WINDOW_MS = 10 * 60 * 1000;
/** 窗口内最多允许的失败次数 */
export const MAX_LOGIN_FAILURES = 5;

/** 注册 passkey 时使用的稳定 user handle（WebAuthn user.id，最多 64 字节） */
const ADMIN_USER_HANDLE = "campus-song-wall-admin";

export type ChallengeKind = "registration" | "authentication";

export type PasskeyRecord = {
  /** base64url 编码的 credential ID */
  id: string;
  /** base64url 编码的 COSE public key */
  publicKey: string;
  counter: number;
  transports?: string[];
  deviceType?: string;
  backedUp?: boolean;
  createdAt: number;
};

export type Challenge = {
  value: string;
  kind: ChallengeKind;
  expiresAt: number;
};

export type PreAuth = {
  expiresAt: number;
  challenge: Challenge | null;
};

export type SessionRecord = {
  expiresAt: number;
};

type FailureWindow = {
  count: number;
  windowStart: number;
};

type AuthStore = {
  passkeys: PasskeyRecord[];
  preAuths: Map<string, PreAuth>;
  sessions: Map<string, SessionRecord>;
  failures: FailureWindow;
};

const globalAuth = globalThis as unknown as { __campusSongWallAuth?: AuthStore };

function createStore(): AuthStore {
  return {
    passkeys: [],
    preAuths: new Map(),
    sessions: new Map(),
    failures: { count: 0, windowStart: 0 },
  };
}

const store: AuthStore = globalAuth.__campusSongWallAuth ?? createStore();
globalAuth.__campusSongWallAuth = store;

function now(): number {
  return Date.now();
}

function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function prunePreAuths(): void {
  const timestamp = now();
  for (const [id, preAuth] of store.preAuths) {
    if (preAuth.expiresAt <= timestamp) store.preAuths.delete(id);
  }
}

function pruneSessions(): void {
  const timestamp = now();
  for (const [id, session] of store.sessions) {
    if (session.expiresAt <= timestamp) store.sessions.delete(id);
  }
}

/** 读取配置好的管理员口令；未配置时返回 null（管理员功能整体不可用） */
export function getAdminPassword(): string | null {
  const value = process.env.ADMIN_PASSWORD?.trim();
  return value ? value : null;
}

/** 常量时间比较，避免根据响应时间猜口令 */
export function verifyAdminPassword(candidate: string): boolean {
  const expected = getAdminPassword();
  if (!expected) return false;
  return timingSafeEqual(digest(candidate), digest(expected));
}

export function getLoginRateLimit(): { limited: boolean; retryAfterMs: number } {
  const failures = store.failures;
  if (failures.count === 0) return { limited: false, retryAfterMs: 0 };
  const elapsed = now() - failures.windowStart;
  if (elapsed >= LOGIN_WINDOW_MS) {
    store.failures = { count: 0, windowStart: 0 };
    return { limited: false, retryAfterMs: 0 };
  }
  if (failures.count < MAX_LOGIN_FAILURES) return { limited: false, retryAfterMs: 0 };
  return { limited: true, retryAfterMs: Math.max(0, LOGIN_WINDOW_MS - elapsed) };
}

export function recordLoginFailure(): void {
  const current = store.failures;
  const timestamp = now();
  if (current.count === 0 || timestamp - current.windowStart >= LOGIN_WINDOW_MS) {
    store.failures = { count: 1, windowStart: timestamp };
    return;
  }
  current.count += 1;
}

export function clearLoginFailures(): void {
  store.failures = { count: 0, windowStart: 0 };
}

/** 口令通过后签发的一次性 pre-auth 凭证（放在 HttpOnly cookie 里） */
export function createPreAuth(): string {
  prunePreAuths();
  const id = randomToken();
  store.preAuths.set(id, { expiresAt: now() + PREAUTH_TTL_MS, challenge: null });
  return id;
}

export function getPreAuth(id: string | undefined): PreAuth | null {
  if (!id) return null;
  const preAuth = store.preAuths.get(id);
  if (!preAuth) return null;
  if (preAuth.expiresAt <= now()) {
    store.preAuths.delete(id);
    return null;
  }
  return preAuth;
}

/**
 * 为当前 pre-auth 会话记录一个 WebAuthn challenge。
 * 传入 value 时使用外部生成的值（通常是 generate*Options 返回的 options.challenge），
 * 不传则内部随机生成——两者都必须与客户端实际签名的 challenge 完全一致。
 */
export function setPreAuthChallenge(id: string, kind: ChallengeKind, value: string = randomToken()): Challenge | null {
  const preAuth = store.preAuths.get(id);
  if (!preAuth || preAuth.expiresAt <= now()) return null;
  const challenge: Challenge = {
    value,
    kind,
    expiresAt: now() + CHALLENGE_TTL_MS,
  };
  preAuth.challenge = challenge;
  return challenge;
}

/** 读取当前 pre-auth 会话里的 challenge（不删除，成功后由调用方清理） */
export function getPreAuthChallenge(id: string, kind: ChallengeKind): Challenge | null {
  const preAuth = store.preAuths.get(id);
  if (!preAuth) return null;
  const challenge = preAuth.challenge;
  if (!challenge || challenge.kind !== kind || challenge.expiresAt <= now()) return null;
  return challenge;
}

export function deletePreAuth(id: string): void {
  store.preAuths.delete(id);
}

/** 注册 passkey 时用的稳定 user handle */
export function getAdminUserHandle() {
  // 用 Uint8Array 包一层，确保返回的是 Uint8Array<ArrayBuffer>（@simplewebauthn 的类型要求）
  return new Uint8Array(new TextEncoder().encode(ADMIN_USER_HANDLE));
}

export function createSession(): string {
  pruneSessions();
  const id = randomToken();
  store.sessions.set(id, { expiresAt: now() + SESSION_TTL_MS });
  return id;
}

export function getSession(id: string | undefined): SessionRecord | null {
  if (!id) return null;
  const session = store.sessions.get(id);
  if (!session) return null;
  if (session.expiresAt <= now()) {
    store.sessions.delete(id);
    return null;
  }
  return session;
}

export function destroySession(id: string | undefined): void {
  if (id) store.sessions.delete(id);
}

export function listPasskeys(): PasskeyRecord[] {
  return [...store.passkeys];
}

export function passkeyCount(): number {
  return store.passkeys.length;
}

export function hasPasskeys(): boolean {
  return store.passkeys.length > 0;
}

export function findPasskey(id: string): PasskeyRecord | null {
  return store.passkeys.find((passkey) => passkey.id === id) ?? null;
}

export function addPasskey(record: PasskeyRecord): void {
  if (store.passkeys.some((passkey) => passkey.id === record.id)) return;
  store.passkeys.push(record);
}

export function updatePasskeyCounter(id: string, counter: number): void {
  const passkey = findPasskey(id);
  if (passkey) passkey.counter = counter;
}

/** 仅供测试使用：清空所有认证状态 */
export function __resetAuthStateForTests(): void {
  store.passkeys.length = 0;
  store.preAuths.clear();
  store.sessions.clear();
  store.failures = { count: 0, windowStart: 0 };
}
