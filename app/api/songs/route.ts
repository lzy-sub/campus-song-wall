import { NextResponse } from "next/server";
import { addSong, listSongs } from "@/lib/songs";

export async function GET() {
  return NextResponse.json({ songs: listSongs() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const song = typeof body?.song === "string" ? body.song.trim() : "";
  const artist = typeof body?.artist === "string" ? body.artist.trim() : "";
  const requester = typeof body?.requester === "string" ? body.requester.trim() : "";

  if (!song || !requester) {
    return NextResponse.json({ error: "歌名和点歌人不能为空" }, { status: 400 });
  }
  if (song.length > 80 || artist.length > 80 || requester.length > 30) {
    return NextResponse.json({ error: "内容太长" }, { status: 400 });
  }

  return NextResponse.json({ song: addSong({ song, artist, requester }) }, { status: 201 });
}