import { randomUUID } from "node:crypto";

export type SongRequest = {
  id: string;
  song: string;
  artist: string;
  requester: string;
  hidden: boolean;
  hiddenAt: string | null;
  createdAt: string;
};

type SongStore = {
  songs: SongRequest[];
};

const globalStore = globalThis as unknown as { __campusSongWall?: SongStore };
const store = globalStore.__campusSongWall ?? { songs: [] };
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

export function findSong(id: string) {
  return store.songs.find((item) => item.id === id) ?? null;
}

export function hideSong(id: string) {
  const song = findSong(id);
  if (!song) return null;
  if (!song.hidden) {
    song.hidden = true;
    song.hiddenAt = new Date().toISOString();
  }
  return song;
}

/** 仅供测试使用：清空内存里的点歌数据 */
export function __resetSongsForTests(): void {
  store.songs.length = 0;
}
