"use client";

import { FormEvent, useEffect, useState } from "react";

type Song = {
  id: string;
  song: string;
  artist: string;
  requester: string;
  createdAt: string;
};

export default function HomePage() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [form, setForm] = useState({ song: "", artist: "", requester: "" });
  const [error, setError] = useState("");

  async function loadSongs() {
    const response = await fetch("/api/songs", { cache: "no-store" });
    const data = await response.json();
    setSongs(data.songs ?? []);
  }

  useEffect(() => {
    void loadSongs();
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

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 20px" }}>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>校园点歌墙</h1>
      <p style={{ color: "#666", marginBottom: 28 }}>一个可供新手练习前后端和 PR 流程的迷你项目。</p>

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
            <strong>{song.song}</strong>
            {song.artist ? " · " + song.artist : ""}
            <div style={{ color: "#777", fontSize: 14, marginTop: 4 }}>点歌人：{song.requester}</div>
          </li>
        ))}
        {!songs.length ? <li style={{ color: "#777" }}>还没有点歌。</li> : null}
      </ul>
    </main>
  );
}