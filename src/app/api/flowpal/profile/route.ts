import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

const profileCookie = "flowpal-profile-id";

function linkCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

export async function GET() {
  const cookieStore = await cookies();
  const existingId = cookieStore.get(profileCookie)?.value;
  const supabase = getSupabaseServer();

  if (existingId) {
    const { data } = await supabase.from("flowpal_users").select("id, link_code, line_user_id").eq("id", existingId).maybeSingle();
    if (data) return NextResponse.json({ id: data.id, linkCode: data.link_code, linked: Boolean(data.line_user_id) });
  }

  const { data, error } = await supabase
    .from("flowpal_users")
    .insert({ link_code: linkCode() })
    .select("id, link_code, line_user_id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const response = NextResponse.json({ id: data.id, linkCode: data.link_code, linked: false });
  response.cookies.set(profileCookie, data.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365, path: "/" });
  return response;
}
