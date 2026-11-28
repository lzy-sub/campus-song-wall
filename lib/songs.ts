import { randomUUID } from "node:crypto";

export type SongRequest = {
  id: string;
  song: string;
  artist: string;
  requester: string;
  hidden: boolean;
  /** 被管理员隐藏的时间，未隐藏时为 null */
  hiddenAt: string | null;
  createdAt: string;
};

/** 管理操作审计记录（内存版，重启丢失） */
export type AuditEntry = {
  id: string;
  songId: string;
  /** 被隐藏歌曲的歌名快照，审计应记录操作当时的不可变信息 */
  song: string;
  action: "hide";
  at: string;
};

type SongStore = {
  songs: SongRequest[];
  audit: AuditEntry[];
};

const globalStore = globalThis as unknown as { __campusSongWall?: SongStore };
const store = globalStore.__campusSongWall ?? { songs: [], audit: [] };
globalStore.__campusSongWall = store;

export function listSongs() {
  return store.songs.filter((song) => !song.hidden);
}

export function addSong(input: { song: string; artist: string; requester: string }) {
  const song: SongRequest = {
    id: randomUUID(),
    song: input.song,
    artist: input.artist,
    requester: input.requester,
    hidden: false,
    hiddenAt: null,
    createdAt: new Date().toISOString(),
  };
  store.songs.unshift(song);
  return song;
}

export function hideSong(id: string) {
  const song = store.songs.find((item) => item.id === id);
  if (!song) return null;
  // 已隐藏则幂等返回：不覆盖首次隐藏时间、不重复写审计。
  if (song.hidden) return song;
  song.hidden = true;
  song.hiddenAt = new Date().toISOString();
  store.audit.unshift({
    id: randomUUID(),
    songId: song.id,
    song: song.song,
    action: "hide",
    at: song.hiddenAt,
  });
  return song;
}

export function listAudit() {
  return store.audit;
}
