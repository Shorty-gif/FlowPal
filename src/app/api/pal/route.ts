import { NextResponse } from "next/server";

type PalRequest = {
  message?: string;
  context?: {
    today?: string;
    school?: string;
    sleepTime?: string;
    events?: string[];
    plannedWork?: string[];
    tasks?: string[];
  };
};

function outputText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const response = payload as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  return response.output?.flatMap((item) => item.content ?? []).filter((item) => item.type === "output_text").map((item) => item.text ?? "").join("").trim() ?? "";
}

export async function POST(request: Request) {
  const body = await request.json() as PalRequest;
  const message = body.message?.trim();
  if (!message) return NextResponse.json({ error: "A message is required." }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ reply: null, configured: false });

  const context = body.context ?? {};
  const prompt = [
    `Today: ${context.today ?? "Unknown"}`,
    `School rules: ${context.school ?? "Unknown"}; sleep by ${context.sleepTime ?? "Unknown"}.`,
    `Today's fixed blocks: ${(context.events ?? []).join("; ") || "None"}.`,
    `Current planned work: ${(context.plannedWork ?? []).join("; ") || "None"}.`,
    `Open tasks: ${(context.tasks ?? []).join("; ") || "None"}.`,
    `Student message: ${message}`,
  ].join("\n");

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5-mini",
        instructions: "You are Pal, FlowPal's warm, practical student planning companion. Answer the student's question naturally and concisely. Use the supplied schedule context; never invent assignments or availability. You can offer a clear next step, explain a deadline, or encourage a realistic break. You cannot directly modify the schedule, so when an action is needed, explain the best change in one sentence.",
        input: prompt,
        max_output_tokens: 250,
      }),
    });
    if (!response.ok) throw new Error(await response.text());
    const reply = outputText(await response.json());
    return NextResponse.json({ reply: reply || "I’m here—could you try asking that one more time?", configured: true });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown request error";
    console.error("Pal API request failed:", detail);
    return NextResponse.json({ reply: null, configured: false, error: process.env.NODE_ENV === "development" ? detail.slice(0, 700) : undefined });
  }
}
