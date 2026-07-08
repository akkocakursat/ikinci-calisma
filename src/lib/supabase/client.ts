import { createBrowserClient } from "@supabase/ssr";

// Uygulamanın veritabanı SABİT olarak "ikinci-calisma" Supabase projesidir.
// Yanlış ortam değişkeni tanımlarının siteyi başka projeye bağlamasını
// önlemek için adres bilinçli olarak koda gömülüdür (anahtar herkese açık
// bir istemci anahtarıdır; asıl koruma RLS'tedir).
export const SUPABASE_URL = "https://mhqjrvghrhnyzuzeprpx.supabase.co";
export const SUPABASE_KEY = "sb_publishable_3G5E2SPoUITGQ_IE8nmWOQ_u4Z8dzFD";

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
}
