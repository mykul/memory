/* ============================================================
   Leaderboard configuration
   ------------------------------------------------------------
   Fill these in to enable the SHARED (global) leaderboard that
   all your friends see. Until then, the leaderboard still works
   in "this device only" mode so the game runs fine.

   The anon key is SAFE to commit/expose publicly *when* Row Level
   Security is enabled on the table. The SQL in README.md sets RLS
   so this key can only read and insert rows on the `scores`
   table — nothing else.
   ============================================================ */
window.MATCH_CONFIG = {
  // e.g. "https://abcd1234.supabase.co"
  SUPABASE_URL: "YOUR_SUPABASE_URL",
  // the "anon public" key from Project Settings → API
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY",
};
