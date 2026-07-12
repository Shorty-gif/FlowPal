import { createClient } from "@supabase/supabase-js";

export function getSupabaseServer() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  // This client is only used in server routes and Netlify Functions. Never expose
  // the service-role key to the browser.
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
