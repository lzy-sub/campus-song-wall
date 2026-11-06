"use client";

import { FormEvent, useEffect, useState } from "react";

import AdminPanel, { type AdminSession } from "@/components/AdminPanel";

type Song = {
  id: string;
  song: string;
  artist: string;
  requester: string;
  hidden: boolean;
  hiddenAt: string | null;
  createdAt: string;
};

export default function HomePage() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [form, setForm] = useState({ song: "", artist: "", requester: "" });
  const [error, setError] = useState("");
  const [adminError, setAdminError] = useState("");
  const [session, setSession] = useState<AdminSession>({ authenticated: false, hasPasskey: false });

  async function loadSongs() {
    const response = await fetch("/api/songs", { cache: "no-store" });
    const data = await response.json();
    setSongs(data.songs ?? []);
  }

  async function loadSession() {
    const response = await fetch("/api/admin/session", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setSession({ authenticated: Boolean(data.authenticated), hasPasskey: Boolean(data.hasPasskey) });
  }

  useEffect(() => {
    void loadSongs();
    void loadSession();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/songs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "提交失败");
      return;
    }
    setForm({ song: "", artist: "", requester: "" });
    await loadSongs();
  }

  async function hideSong(id: string) {
    setAdminError("");
    const response = await fetch(`/api/songs/${id}`, { method: "PATCH" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setAdminError(data.error ?? "隐藏失败");
      return;
    }
    await loadSongs();
  }

  async function handleSessionChange(next: AdminSession) {
    setSession(next);
    setAdminError("");
    await loadSongs();
  }

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 20px" }}>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>校园点歌墙</h1>
      <p style={{ color: "#666", marginBottom: 28 }}>一个可供新手练习前后端和 PR 流程的迷你项目。</p>

      <AdminPanel
        authenticated={session.authenticated}
        hasPasskey={session.hasPasskey}
        onSessionChange={(next) => void handleSessionChange(next)}
      />

      {adminError ? <p style={{ color: "crimson", margin: "0 0 12px" }}>{adminError}</p> : null}

      <form onSubmit={submit} style={{ display: "grid", gap: 10, padding: 20, background: "white", borderRadius: 16 }}>
        <input value={form.song} onChange={(e) => setForm({ ...form, song: e.target.value })} placeholder="歌名" style={{ padding: 10 }} />
        <input value={form.artist} onChange={(e) => setForm({ ...form, artist: e.target.value })} placeholder="歌手" style={{ padding: 10 }} />
        <input value={form.requester} onChange={(e) => setForm({ ...form, requester: e.target.value })} placeholder="点歌人" style={{ padding: 10 }} />
        <button type="submit" style={{ padding: 10, cursor: "pointer" }}>提交点歌</button>
        {error ? <p style={{ color: "crimson", margin: 0 }}>{error}</p> : null}
      </form>

      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 10, marginTop: 24 }}>
        {songs.map((song) => (
          <li key={song.id} style={{ padding: 16, background: "white", borderRadius: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <div>
                <strong>{song.song}</strong>
                {song.artist ? " · " + song.artist : ""}
                <div style={{ color: "#777", fontSize: 14, marginTop: 4 }}>点歌人：{song.requester}</div>
              </div>
              {session.authenticated ? (
                <button
                  type="button"
                  onClick={() => void hideSong(song.id)}
                  style={{ padding: "6px 12px", cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  隐藏
                </button>
              ) : null}
            </div>
          </li>
        ))}
        {!songs.length ? <li style={{ color: "#777" }}>还没有点歌。</li> : null}
      </ul>
    </main>
  );
}
