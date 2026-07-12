import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

type ClientTask = { id: string | number; title: string; subject: string; time: string; duration: number; due: string; dueDate?: string; color: string; status: "upcoming" | "active" | "done" };

function toClientTask(row: Record<string, unknown>): ClientTask {
  const dueAt = typeof row.due_at === "string" ? row.due_at.slice(0, 10) : undefined;
  return {
    id: String(row.source_id ?? row.id), title: String(row.title), subject: String(row.category ?? "Schoolwork"),
    time: String(row.time_label ?? "16:00"), duration: Number(row.duration_minutes ?? 45),
    due: String(row.due_label ?? (dueAt ? `Due ${dueAt}` : "No due date")), dueDate: dueAt,
    color: String(row.color ?? "yellow"), status: row.status === "done" ? "done" : row.status === "active" ? "active" : "upcoming",
  };
}

async function profileId() {
  return (await cookies()).get("flowpal-profile-id")?.value;
}

export async function GET() {
  const userId = await profileId();
  if (!userId) return NextResponse.json({ tasks: [] });
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.from("tasks").select("*").eq("user_id", userId).order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tasks: (data ?? []).map((row) => toClientTask(row as Record<string, unknown>)) });
}

export async function PUT(request: NextRequest) {
  const userId = await profileId();
  if (!userId) return NextResponse.json({ error: "Profile is not ready yet." }, { status: 409 });
  const body = await request.json() as { tasks?: ClientTask[] };
  const tasks = body.tasks ?? [];
  if (!tasks.length) return NextResponse.json({ ok: true });
  const supabase = getSupabaseServer();
  const rows = tasks.map((task) => ({
    user_id: userId, source_id: String(task.id), title: task.title, category: task.subject || "Schoolwork",
    source: String(task.id).startsWith("classroom-") ? "google_classroom" : "manual",
    duration_minutes: task.duration, status: task.status === "upcoming" ? "todo" : task.status,
    due_at: task.dueDate ? `${task.dueDate}T23:59:00+09:00` : null,
    due_label: task.due, time_label: task.time, color: task.color,
  }));
  const { error } = await supabase.from("tasks").upsert(rows, { onConflict: "user_id,source_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
