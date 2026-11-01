import { randomUUID } from "node:crypto";

export type SongRequest = {
  id: string;
  song: string;
  artist: string;
  requester: string;
  hidden: boolean;
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
    createdAt: new Date().toISOString(),
  };
  store.songs.unshift(song);
  return song;
}

export function hideSong(id: string) {
  const song = store.songs.find((item) => item.id === id);
  if (!song) return null;
  song.hidden = true;
  return song;
}