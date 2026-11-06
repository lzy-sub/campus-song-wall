import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { __resetSongsForTests, addSong, findSong, hideSong, listSongs } from "../lib/songs";

beforeEach(() => {
  __resetSongsForTests();
});

test("隐藏后不再出现在公开列表里，并记录 hiddenAt", () => {
  const song = addSong({ song: "晴天", artist: "周杰伦", requester: "小明" });
  assert.equal(listSongs().length, 1);

  const hidden = hideSong(song.id);
  assert.ok(hidden);
  assert.equal(hidden?.hidden, true);
  assert.ok(hidden?.hiddenAt);
  assert.equal(listSongs().length, 0);
  assert.equal(findSong(song.id)?.hidden, true);
});

test("隐藏不存在的点歌返回 null", () => {
  assert.equal(hideSong("not-exist"), null);
});
