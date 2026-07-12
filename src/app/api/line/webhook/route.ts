import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

type LineEvent = {
  type?: string;
  replyToken?: string;
  message?: { type?: string; text?: string };
  source?: { userId?: string };
};

function validSignature(body: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64");
  return expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

async function palReply(text: string, lineUserId?: string) {
  const message = text.trim().toLowerCase();
  const requestedTitle = text.trim().replace(/^(start|finish|done)\s+/i, "").trim();
  let userId: string | undefined;
  try {
    if (lineUserId) {
      const supabase = getSupabaseServer();
      const { data: profile } = await supabase.from("flowpal_users").select("id").eq("line_user_id", lineUserId).maybeSingle();
      userId = profile?.id;

      if (userId && (message.includes("my tasks") || message.includes("tasks for today") || message.includes("what do i have"))) {
        const { data: tasks } = await supabase.from("tasks").select("title, duration_minutes, due_label").eq("user_id", userId).neq("status", "done").order("due_at", { ascending: true, nullsFirst: false }).limit(6);
        if (!tasks?.length) return "You’re clear right now — no unfinished FlowPal tasks saved. ✨";
        return `You have ${tasks.length} task${tasks.length === 1 ? "" : "s"} left:\n${tasks.map((task) => `• ${task.title} · ${task.duration_minutes} min${task.due_label ? ` · ${task.due_label}` : ""}`).join("\n")}`;
      }

      if (userId && (message.startsWith("start ") || message.startsWith("finish ") || message.startsWith("done ")) && requestedTitle) {
        const { data: matches } = await supabase.from("tasks").select("id, title").eq("user_id", userId).neq("status", "done").ilike("title", `%${requestedTitle}%`).limit(1);
        const task = matches?.[0];
        if (task) {
          const finishing = message.startsWith("finish ") || message.startsWith("done ");
          await supabase.from("tasks").update(finishing ? { status: "done", completed_at: new Date().toISOString() } : { status: "active" }).eq("id", task.id);
          return finishing
            ? `Logged — ${task.title} is complete. Nice work! Check FlowPal for your updated plan.`
            : `Nice — I started ${task.title}. Send “finish ${task.title}” when you’re done.`;
        }
      }
    }
  } catch (error) {
    console.error("Could not update FlowPal task from LINE:", error);
  }

  if (message.startsWith("start ")) return `Nice — I started ${requestedTitle}. Send “finish ${requestedTitle}” when you’re done.`;
  if (message.startsWith("finish ") || message.startsWith("done")) return "Logged! Great work — check FlowPal to see your updated plan.";
  if (message.includes("break")) return "Take the break. Open FlowPal when you’re ready and I’ll help you replan.";
  if (message.includes("next") || message.includes("what should")) return "Open FlowPal and ask Pal for your next task. Your live schedule is there.";
  return "I’m Pal from FlowPal. Try “my tasks,” “start Physics,” “finish Physics,” “I need a 30 min break,” or “what’s next?”";
}

async function reply(replyToken: string, text: string, token: string) {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
  });
}

export async function POST(request: Request) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!secret || !token) return NextResponse.json({ error: "LINE is not configured." }, { status: 503 });

  const rawBody = await request.text();
  if (!validSignature(rawBody, request.headers.get("x-line-signature"), secret)) return NextResponse.json({ error: "Invalid LINE signature." }, { status: 401 });

  const payload = JSON.parse(rawBody) as { events?: LineEvent[] };
  await Promise.all((payload.events ?? []).map(async (event) => {
    if (!event.replyToken) return;
    const lineUserId = event.source?.userId;
    const text = event.message?.type === "text" ? event.message.text?.trim() ?? "" : "";
    const requestedCode = text.match(/^link\s+([a-z0-9]{6})$/i)?.[1]?.toUpperCase();
    if (lineUserId) {
      try {
        const supabase = getSupabaseServer();
        if (requestedCode) {
          const { data: profile } = await supabase.from("flowpal_users").select("id").eq("link_code", requestedCode).maybeSingle();
          if (profile) {
            await supabase.from("flowpal_users").update({ line_user_id: null }).eq("line_user_id", lineUserId).neq("id", profile.id);
            await supabase.from("flowpal_users").update({ line_user_id: lineUserId }).eq("id", profile.id);
            return reply(event.replyToken, "Connected! Pal can now send your FlowPal reminders here.", token);
          }
        }
        await supabase.from("flowpal_users").upsert({ line_user_id: lineUserId }, { onConflict: "line_user_id" });
      } catch (error) {
        // LINE replies should still work while the database is being configured.
        console.error("Could not save FlowPal LINE user:", error);
      }
    }
    if (event.type === "follow") return reply(event.replyToken, "Hey, I’m Pal! Message me when you start or finish work, and I’ll keep you moving.", token);
    if (event.type === "message" && event.message?.type === "text") return reply(event.replyToken, await palReply(text, lineUserId), token);
  }));
  return NextResponse.json({ ok: true });
}
