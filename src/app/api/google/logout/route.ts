import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("flowpal-classroom-import");
  response.cookies.delete("flowpal-google-oauth-state");
  return response;
}
