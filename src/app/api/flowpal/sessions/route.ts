import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

type Session = { title: string; startsAt: string; endsAt: string };

export async function PUT(request: NextRequest) {
  const userId = (await cookies()).get("flowpal-profile-id")?.value;
  if (!userId) return NextResponse.json({ error: "Profile is not ready yet." }, { status: 409 });
  const { sessions = [] } = await request.json() as { sessions?: Session[] };
  const supabase = getSupabaseServer();
  const now = new Date().toISOString();
  const { error: removeError } = await supabase.from("study_sessions").delete().eq("user_id", userId).eq("status", "planned").gte("starts_at", now);
  if (removeError) return NextResponse.json({ error: removeError.message }, { status: 500 });
  if (!sessions.length) return NextResponse.json({ ok: true });
  const { error: addError } = await supabase.from("study_sessions").insert(sessions.map((session) => ({
    user_id: userId, title: session.title, starts_at: session.startsAt, ends_at: session.endsAt, status: "planned",
  })));
  if (addError) return NextResponse.json({ error: addError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
