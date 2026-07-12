import type { Config } from "@netlify/functions";
import { getSupabaseServer } from "../../src/lib/supabase-server";

type FlowPalUser = { id: string; line_user_id: string; timezone: string };
type FlowPalTask = { title: string; duration_minutes: number; due_at: string | null };
type StudySession = { id: string; title: string; starts_at: string; user_id: string };

const jstParts = (date: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || "Asia/Tokyo",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date).reduce<Record<string, string>>((all, part) => ({ ...all, [part.type]: part.value }), {});
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), minute: Number(parts.minute) };
};

async function sendLinePush(userId: string, text: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is missing.");
  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to: userId, messages: [{ type: "text", text }] }),
  });
  if (!response.ok) throw new Error(`LINE push failed (${response.status}).`);
}

function taskSummary(tasks: FlowPalTask[]) {
  if (!tasks.length) return "You have no remaining tasks. Enjoy the breathing room ✨";
  const lines = tasks.slice(0, 5).map((task) => `• ${task.title} (${task.duration_minutes} min)`).join("\n");
  return `Flow check-in: ${tasks.length} task${tasks.length === 1 ? "" : "s"} left.\n${lines}\n\nOpen FlowPal to see your plan.`;
}

export default async () => {
  const supabase = getSupabaseServer();
  const now = new Date();
  const { data: users, error: usersError } = await supabase
    .from("flowpal_users")
    .select("id, line_user_id, timezone")
    .eq("reminders_enabled", true)
    .not("line_user_id", "is", null);
  if (usersError) throw usersError;

  await Promise.all((users ?? []).map(async (user) => {
    const profile = user as FlowPalUser;
    const local = jstParts(now, profile.timezone);

    // Morning briefing plus the 3-hour Flow checks: 07:00, 10:00, 13:00,
    // 16:00, 19:00, and 22:00 in each student's own timezone.
    if (local.minute < 5 && [7, 10, 13, 16, 19, 22].includes(local.hour)) {
      const reminderType = `${local.date}-checkin-${local.hour}`;
      const { data: alreadySent } = await supabase
        .from("reminder_log")
        .select("id")
        .eq("user_id", profile.id)
        .eq("reminder_type", reminderType)
        .maybeSingle();

      if (!alreadySent) {
        const { data: tasks } = await supabase
          .from("tasks")
          .select("title, duration_minutes, due_at")
          .eq("user_id", profile.id)
          .neq("status", "done")
          .order("due_at", { ascending: true, nullsFirst: false });
        await sendLinePush(profile.line_user_id, local.hour === 7 ? `Good morning!\n\n${taskSummary((tasks ?? []) as FlowPalTask[])}` : taskSummary((tasks ?? []) as FlowPalTask[]));
        await supabase.from("reminder_log").insert({ user_id: profile.id, reminder_type: reminderType });
      }
    }

    const windowStart = new Date(now.getTime() - 5 * 60_000).toISOString();
    const { data: sessions } = await supabase
      .from("study_sessions")
      .select("id, title, starts_at, user_id")
      .eq("user_id", profile.id)
      .eq("status", "planned")
      .is("start_reminder_sent_at", null)
      .gte("starts_at", windowStart)
      .lte("starts_at", now.toISOString());
    await Promise.all(((sessions ?? []) as StudySession[]).map(async (session) => {
      await sendLinePush(profile.line_user_id, `Time to start: ${session.title}.\n\nSend “start ${session.title}” when you begin.`);
      await supabase.from("study_sessions").update({ start_reminder_sent_at: now.toISOString() }).eq("id", session.id);
    }));
  }));
};

export const config: Config = {
  schedule: "*/5 * * * *",
};
