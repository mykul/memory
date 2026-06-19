/* ============================================================
   Leaderboard module
   ------------------------------------------------------------
   One small API used by the game:
     Leaderboard.isRemote      -> boolean (shared vs this-device)
     Leaderboard.submit(score) -> Promise  ({ name, seconds, moves })
     Leaderboard.list()        -> Promise<rows>  (deduped, best per name)

   Backend is Supabase REST (PostgREST) when configured, otherwise
   it falls back to localStorage so the game always works.
   ============================================================ */
window.Leaderboard = (() => {
  "use strict";

  const cfg = window.MATCH_CONFIG || {};
  const url = String(cfg.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = String(cfg.SUPABASE_ANON_KEY || "");
  const configured =
    Boolean(url && key) && !url.includes("YOUR_") && !key.includes("YOUR_");

  const TABLE = "scores";
  const LOCAL_KEY = "match:scores";
  const MAX_FETCH = 200; // pull plenty, then dedupe to best-per-name

  // Keep only each name's best (rows arrive sorted fastest-first).
  function dedupeByName(rows) {
    const seen = new Set();
    const out = [];
    for (const r of rows) {
      const k = String(r.name || "").trim().toLowerCase();
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(r);
    }
    return out;
  }

  function bySpeed(a, b) {
    return a.seconds - b.seconds || (a.moves || 0) - (b.moves || 0);
  }

  /* ---------- localStorage backend ---------- */
  function localAll() {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_KEY)) || [];
    } catch (e) {
      return [];
    }
  }
  function localSave(rows) {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(rows.slice(0, MAX_FETCH)));
    } catch (e) {
      /* private mode — ignore */
    }
  }
  async function localSubmit(score) {
    const rows = localAll();
    rows.push({
      name: score.name,
      seconds: score.seconds,
      moves: score.moves,
      created_at: Date.now(),
    });
    rows.sort(bySpeed);
    localSave(rows);
  }
  async function localList() {
    return dedupeByName(localAll().slice().sort(bySpeed));
  }

  /* ---------- Supabase REST backend ---------- */
  function headers(extra) {
    return Object.assign(
      {
        apikey: key,
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
      },
      extra || {}
    );
  }
  async function remoteSubmit(score) {
    const res = await fetch(url + "/rest/v1/" + TABLE, {
      method: "POST",
      headers: headers({ Prefer: "return=minimal" }),
      body: JSON.stringify({
        name: score.name,
        seconds: score.seconds,
        moves: score.moves,
      }),
    });
    if (!res.ok) throw new Error("Leaderboard submit failed: " + res.status);
  }
  async function remoteList() {
    const q =
      "?select=name,seconds,moves" +
      "&order=seconds.asc,moves.asc" +
      "&limit=" +
      MAX_FETCH;
    const res = await fetch(url + "/rest/v1/" + TABLE + q, {
      headers: headers(),
    });
    if (!res.ok) throw new Error("Leaderboard load failed: " + res.status);
    return dedupeByName(await res.json());
  }

  return {
    isRemote: configured,
    submit: configured ? remoteSubmit : localSubmit,
    list: configured ? remoteList : localList,
  };
})();
