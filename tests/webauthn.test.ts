import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { getWebAuthnContext } from "../lib/webauthn";

afterEach(() => {
  delete process.env.WEBAUTHN_RP_ID;
  delete process.env.WEBAUTHN_ORIGIN;
});

test("默认从请求 Origin 推导 RP ID 与 origin", () => {
  const request = new Request("http://localhost:3000/api/admin/login", {
    headers: { origin: "http://localhost:3000" },
  });

  const context = getWebAuthnContext(request);
  assert.equal(context.expectedOrigin, "http://localhost:3000");
  assert.equal(context.rpID, "localhost");
});

test("环境变量可以覆盖 RP ID 与 origin", () => {
  process.env.WEBAUTHN_RP_ID = "song.example.com";
  process.env.WEBAUTHN_ORIGIN = "https://song.example.com";

  const request = new Request("http://localhost:3000/api/admin/login", {
    headers: { origin: "http://localhost:3000" },
  });

  const context = getWebAuthnContext(request);
  assert.equal(context.expectedOrigin, "https://song.example.com");
  assert.equal(context.rpID, "song.example.com");
});

test("请求没有 Origin 时回退到 Host", () => {
  const request = new Request("http://127.0.0.1:3000/api/admin/login");

  const context = getWebAuthnContext(request);
  assert.equal(context.expectedOrigin, "http://127.0.0.1:3000");
  assert.equal(context.rpID, "127.0.0.1");
});
