window.supabaseClient = null;
try {
  if (!window.supabase || !window.supabase.createClient) throw new Error("Supabase library did not load.");
  window.supabaseClient = window.supabase.createClient("https://fumawncedxswwvafecuj.supabase.co","sb_publishable_5ELVcnDfatNVXqHNM7WKjQ_wJ9qC8F4");
} catch (e) {
  window.supabaseInitError = e;
}