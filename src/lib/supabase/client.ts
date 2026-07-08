import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // anon anahtarı herkese açık bir istemci anahtarıdır; asıl koruma RLS'tedir.
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://mhqjrvghrhnyzuzeprpx.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "sb_publishable_3G5E2SPoUITGQ_IE8nmWOQ_u4Z8dzFD"
  );
}
