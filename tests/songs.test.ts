import assert from "node:assert/strict";
import { test } from "node:test";
import { checkAdmin } from "../lib/admin";
import { addSong, hideSong, listAudit, listSongs } from "../lib/songs";

/** 临时设置 ADMIN_PASSWORD，结束后恢复原状（含原本未设置的情况）。 */
function withAdminPassword(value: string, run: () => void) {
  const had = Object.prototype.hasOwnProperty.call(
    process.env,
    "ADMIN_PASSWORD",
  );
  const original = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_PASSWORD = value;
  try {
    run();
  } finally {
    if (had) process.env.ADMIN_PASSWORD = original;
    else delete process.env.ADMIN_PASSWORD;
  }
}

test("addSong 创建一条可见的点歌记录", () => {
  const song = addSong({ song: "晴天", artist: "周杰伦", requester: "小明" });

  assert.equal(song.song, "晴天");
  assert.equal(song.artist, "周杰伦");
  assert.equal(song.requester, "小明");
  assert.equal(song.hidden, false);
  assert.equal(song.hiddenAt, null);
  assert.ok(song.id);
  assert.ok(song.createdAt);

  assert.ok(listSongs().some((item) => item.id === song.id));
});

test("hideSong 隐藏后 listSongs 不再返回", () => {
  const song = addSong({
    song: "隐藏测试",
    artist: "测试歌手",
    requester: "测试人",
  });

  const hidden = hideSong(song.id);
  assert.ok(hidden);
  assert.equal(hidden.hidden, true);
  assert.ok(hidden.hiddenAt);

  assert.ok(!listSongs().some((item) => item.id === song.id));
});

test("hideSong 会写入一条 hide 审计记录", () => {
  const song = addSong({
    song: "审计测试",
    artist: "测试歌手",
    requester: "测试人",
  });

  const hidden = hideSong(song.id);
  assert.ok(hidden);

  const entry = listAudit().find((item) => item.songId === song.id);
  assert.ok(entry);
  assert.equal(entry.action, "hide");
  assert.equal(entry.song, "审计测试");
  assert.equal(entry.at, hidden.hiddenAt);
});

test("hideSong 重复隐藏是幂等的（不覆盖时间、不重复审计）", () => {
  const song = addSong({
    song: "重复隐藏",
    artist: "测试歌手",
    requester: "测试人",
  });

  const first = hideSong(song.id);
  assert.ok(first);
  const firstHiddenAt = first.hiddenAt;
  const countAfterFirst = listAudit().filter(
    (item) => item.songId === song.id,
  ).length;

  const second = hideSong(song.id);
  assert.ok(second);
  assert.equal(second.hiddenAt, firstHiddenAt);
  assert.equal(
    listAudit().filter((item) => item.songId === song.id).length,
    countAfterFirst,
  );
});

test("hideSong 对不存在的 id 返回 null", () => {
  assert.equal(hideSong("no-such-id"), null);
});

test("checkAdmin：未配置口令返回 500", () => {
  withAdminPassword("", () => {
    const result = checkAdmin(new Request("http://localhost/"));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 500);
    }
  });
});

test("checkAdmin：口令错误返回 401", () => {
  withAdminPassword("correct", () => {
    const request = new Request("http://localhost/", {
      headers: { "x-admin-password": "wrong" },
    });
    const result = checkAdmin(request);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 401);
    }
  });
});

test("checkAdmin：口令正确通过", () => {
  withAdminPassword("correct", () => {
    const request = new Request("http://localhost/", {
      headers: { "x-admin-password": "correct" },
    });
    const result = checkAdmin(request);
    assert.equal(result.ok, true);
  });
});
