"use client";

import { FormEvent, useState } from "react";
import {
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";

export type AdminSession = {
  authenticated: boolean;
  hasPasskey: boolean;
};

type AdminPanelProps = {
  authenticated: boolean;
  hasPasskey: boolean;
  onSessionChange: (session: AdminSession) => void;
};

type Stage = "idle" | "password" | "register" | "passkey";

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

function describeError(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    if (error.name === "NotAllowedError") return "操作已取消或超时";
    if (error.name === "InvalidStateError") return "这个设备已经注册过 passkey 了";
    if (error.message) return error.message;
  }
  return fallback;
}

export default function AdminPanel({ authenticated, hasPasskey, onSessionChange }: AdminPanelProps) {
  const [stage, setStage] = useState<Stage>("idle");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  function resetToIdle() {
    setStage("idle");
    setError("");
    setPassword("");
  }

  function completeLogin() {
    onSessionChange({ authenticated: true, hasPasskey: true });
    resetToIdle();
  }

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await readJson(response);
      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "口令验证失败");
        return;
      }
      setPassword("");
      setStage(data.next === "register" ? "register" : "passkey");
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setPending(false);
    }
  }

  async function registerPasskey() {
    setPending(true);
    setError("");
    try {
      const optionsResponse = await fetch("/api/admin/passkey/register", { cache: "no-store" });
      const options = await readJson(optionsResponse);
      if (!optionsResponse.ok) {
        setError(typeof options.error === "string" ? options.error : "无法开始 passkey 注册");
        return;
      }

      const registration = await startRegistration({
        optionsJSON: options as unknown as PublicKeyCredentialCreationOptionsJSON,
      });

      const verifyResponse = await fetch("/api/admin/passkey/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: registration }),
      });
      const verifyData = await readJson(verifyResponse);
      if (!verifyResponse.ok) {
        setError(typeof verifyData.error === "string" ? verifyData.error : "passkey 注册失败");
        return;
      }
      completeLogin();
    } catch (caught) {
      setError(describeError(caught, "passkey 注册失败"));
    } finally {
      setPending(false);
    }
  }

  async function loginWithPasskey() {
    setPending(true);
    setError("");
    try {
      const optionsResponse = await fetch("/api/admin/passkey/login", { cache: "no-store" });
      const options = await readJson(optionsResponse);
      if (!optionsResponse.ok) {
        setError(typeof options.error === "string" ? options.error : "无法开始 passkey 验证");
        return;
      }

      const authentication = await startAuthentication({
        optionsJSON: options as unknown as PublicKeyCredentialRequestOptionsJSON,
      });

      const verifyResponse = await fetch("/api/admin/passkey/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: authentication }),
      });
      const verifyData = await readJson(verifyResponse);
      if (!verifyResponse.ok) {
        setError(typeof verifyData.error === "string" ? verifyData.error : "passkey 验证失败");
        return;
      }
      completeLogin();
    } catch (caught) {
      setError(describeError(caught, "passkey 验证失败"));
    } finally {
      setPending(false);
    }
  }

  async function logout() {
    setPending(true);
    setError("");
    try {
      await fetch("/api/admin/session", { method: "DELETE" });
      onSessionChange({ authenticated: false, hasPasskey });
      setStage("idle");
    } finally {
      setPending(false);
    }
  }

  const hint = authenticated
    ? "已登录 · 口令 + passkey 双因素"
    : hasPasskey
      ? "未登录 · 需要管理员口令 + passkey"
      : "未登录 · 首次使用需先注册 passkey";

  return (
    <section
      style={{
        marginBottom: 24,
        padding: 16,
        background: "white",
        borderRadius: 12,
        border: "1px solid #e4dfd3",
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <strong>管理员</strong>
          <span style={{ color: "#777", fontSize: 14, marginLeft: 8 }}>{hint}</span>
        </div>
        {authenticated ? (
          <button type="button" onClick={logout} disabled={pending} style={{ padding: "6px 12px", cursor: "pointer" }}>
            退出登录
          </button>
        ) : stage === "idle" ? (
          <button
            type="button"
            onClick={() => {
              setError("");
              setStage("password");
            }}
            style={{ padding: "6px 12px", cursor: "pointer" }}
          >
            管理员登录
          </button>
        ) : null}
      </div>

      {!authenticated && stage === "password" ? (
        <form onSubmit={submitPassword} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="管理员口令（第一因素）"
            autoComplete="current-password"
            style={{ padding: 8, flex: "1 1 220px" }}
          />
          <button type="submit" disabled={pending} style={{ padding: "8px 14px", cursor: "pointer" }}>
            {pending ? "验证中…" : "下一步"}
          </button>
          <button type="button" onClick={resetToIdle} disabled={pending} style={{ padding: "8px 14px", cursor: "pointer" }}>
            取消
          </button>
        </form>
      ) : null}

      {!authenticated && stage === "register" ? (
        <div style={{ display: "grid", gap: 8 }}>
          <p style={{ margin: 0, color: "#444", fontSize: 14 }}>
            口令验证通过。首次使用需要注册一个 passkey 作为第二因素，之后每次登录都要用同一设备的
            passkey 再验证一次。
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={registerPasskey} disabled={pending} style={{ padding: "8px 14px", cursor: "pointer" }}>
              {pending ? "等待设备确认…" : "注册管理员 passkey"}
            </button>
            <button type="button" onClick={resetToIdle} disabled={pending} style={{ padding: "8px 14px", cursor: "pointer" }}>
              取消
            </button>
          </div>
        </div>
      ) : null}

      {!authenticated && stage === "passkey" ? (
        <div style={{ display: "grid", gap: 8 }}>
          <p style={{ margin: 0, color: "#444", fontSize: 14 }}>
            口令验证通过。请用已注册的 passkey 设备完成第二因素验证。
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={loginWithPasskey} disabled={pending} style={{ padding: "8px 14px", cursor: "pointer" }}>
              {pending ? "等待设备确认…" : "使用 passkey 验证"}
            </button>
            <button type="button" onClick={resetToIdle} disabled={pending} style={{ padding: "8px 14px", cursor: "pointer" }}>
              取消
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p style={{ color: "crimson", margin: 0, fontSize: 14 }}>{error}</p> : null}
    </section>
  );
}
