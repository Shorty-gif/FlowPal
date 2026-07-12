import crypto from "node:crypto";
import { NextResponse } from "next/server";

type LineEvent = {
  type?: string;
  replyToken?: string;
  message?: { type?: string; text?: string };
};

function validSignature(body: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64");
  return expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

function palReply(text: string) {
  const message = text.trim().toLowerCase();
  if (message.startsWith("start ")) return `Nice — I started ${text.trim().slice(6)}. Send “finish ${text.trim().slice(6)}” when you’re done.`;
  if (message.startsWith("finish ") || message.startsWith("done")) return "Logged! Great work — check FlowPal to see your updated plan.";
  if (message.includes("break")) return "Take the break. Open FlowPal when you’re ready and I’ll help you replan.";
  if (message.includes("next") || message.includes("what should")) return "Open FlowPal and ask Pal for your next task. Your live schedule is there.";
  return "I’m Pal from FlowPal. Try “start Physics,” “finish Physics,” “I need a 30 min break,” or “what’s next?”";
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
    if (event.type === "follow") return reply(event.replyToken, "Hey, I’m Pal! Message me when you start or finish work, and I’ll keep you moving.", token);
    if (event.type === "message" && event.message?.type === "text") return reply(event.replyToken, palReply(event.message.text ?? ""), token);
  }));
  return NextResponse.json({ ok: true });
}
