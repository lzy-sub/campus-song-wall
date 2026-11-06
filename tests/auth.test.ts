import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import {
  MAX_LOGIN_FAILURES,
  __resetAuthStateForTests,
  addPasskey,
  clearLoginFailures,
  createPreAuth,
  createSession,
  deletePreAuth,
  destroySession,
  findPasskey,
  getAdminPassword,
  getLoginRateLimit,
  getPreAuth,
  getSession,
  hasPasskeys,
  listPasskeys,
  recordLoginFailure,
  setPreAuthChallenge,
  getPreAuthChallenge,
  updatePasskeyCounter,
  verifyAdminPassword,
} from "../lib/auth";

const CORRECT_PASSWORD = "correct-horse-battery-staple";

beforeEach(() => {
  __resetAuthStateForTests();
  process.env.ADMIN_PASSWORD = CORRECT_PASSWORD;
});

afterEach(() => {
  __resetAuthStateForTests();
  delete process.env.ADMIN_PASSWORD;
});

test("管理员口令只接受正确值", () => {
  assert.equal(verifyAdminPassword(CORRECT_PASSWORD), true);
  assert.equal(verifyAdminPassword("wrong-password"), false);
  assert.equal(verifyAdminPassword(""), false);
});

test("未配置 ADMIN_PASSWORD 时管理员功能不可用", () => {
  delete process.env.ADMIN_PASSWORD;
  assert.equal(getAdminPassword(), null);
  assert.equal(verifyAdminPassword(""), false);
  assert.equal(verifyAdminPassword("anything"), false);
});

test("连续口令失败达到上限后触发限流，清除后恢复", () => {
  assert.equal(getLoginRateLimit().limited, false);

  for (let index = 0; index < MAX_LOGIN_FAILURES; index += 1) {
    recordLoginFailure();
  }

  const limited = getLoginRateLimit();
  assert.equal(limited.limited, true);
  assert.ok(limited.retryAfterMs > 0);

  clearLoginFailures();
  assert.equal(getLoginRateLimit().limited, false);
});

test("登录会话创建后可校验，注销或过期后失效", () => {
  const sessionId = createSession();
  assert.ok(getSession(sessionId));
  assert.equal(getSession(undefined), null);
  assert.equal(getSession("unknown-session"), null);

  destroySession(sessionId);
  assert.equal(getSession(sessionId), null);
});

test("pre-auth 凭证有生命周期", () => {
  const preAuthId = createPreAuth();
  assert.ok(getPreAuth(preAuthId));
  assert.equal(getPreAuth(undefined), null);
  assert.equal(getPreAuth("unknown-pre-auth"), null);

  deletePreAuth(preAuthId);
  assert.equal(getPreAuth(preAuthId), null);
});

test("WebAuthn challenge 只对对应类型有效", () => {
  const preAuthId = createPreAuth();

  const challenge = setPreAuthChallenge(preAuthId, "registration");
  assert.ok(challenge);
  assert.equal(getPreAuthChallenge(preAuthId, "authentication"), null);

  const registrationChallenge = getPreAuthChallenge(preAuthId, "registration");
  assert.equal(registrationChallenge?.value, challenge?.value);
  assert.equal(registrationChallenge?.kind, "registration");

  const nextChallenge = setPreAuthChallenge(preAuthId, "authentication");
  assert.notEqual(nextChallenge?.value, challenge?.value);
  assert.equal(getPreAuthChallenge(preAuthId, "registration"), null);
  assert.ok(getPreAuthChallenge(preAuthId, "authentication"));
});

test("passkey 记录可以新增、查询与更新计数器", () => {
  assert.equal(hasPasskeys(), false);
  assert.equal(listPasskeys().length, 0);

  addPasskey({
    id: "credential-1",
    publicKey: "public-key-1",
    counter: 0,
    transports: ["internal"],
    createdAt: Date.now(),
  });
  addPasskey({
    id: "credential-1",
    publicKey: "public-key-1-duplicated",
    counter: 0,
    createdAt: Date.now(),
  });

  assert.equal(hasPasskeys(), true);
  assert.equal(listPasskeys().length, 1);
  assert.equal(findPasskey("credential-1")?.publicKey, "public-key-1");
  assert.equal(findPasskey("missing"), null);

  updatePasskeyCounter("credential-1", 7);
  assert.equal(findPasskey("credential-1")?.counter, 7);
});
