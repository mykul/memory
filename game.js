/* ============================================================
   Match! — a mobile-first memory / concentration game
   Vanilla JS, no dependencies. Deploys as a static site.
   ============================================================ */

(() => {
  "use strict";

  /* ---------- Config ---------- */
  // Staggered rows: alternating 4 and 3 cards. Total must be even (pairs).
  const ROW_PATTERN = [4, 3, 4, 3]; // 14 cards = 7 pairs
  const GAME_SECONDS = 90; // "slow" countdown
  const MISMATCH_DELAY = 850; // ms a mismatched pair stays visible
  const GAP = 10; // px between cards (mirror of --gap)

  // 7 distinct pairs, each a unique color + shape combo.
  // Both color AND shape differ per pair, so it's colorblind-friendly.
  const PAIRS = [
    { id: "circle", color: "#e6194b", shape: "circle" },
    { id: "square", color: "#4363d8", shape: "square" },
    { id: "triangle", color: "#2e9e3f", shape: "triangle" },
    { id: "star", color: "#f58231", shape: "star" },
    { id: "diamond", color: "#911eb4", shape: "diamond" },
    { id: "heart", color: "#d4459e", shape: "heart" },
    { id: "hexagon", color: "#0a8a86", shape: "hexagon" },
  ];

  /* ---------- White SVG shapes (viewBox 0 0 100 100) ---------- */
  const SHAPES = {
    circle: '<circle cx="50" cy="50" r="42"/>',
    square: '<rect x="12" y="12" width="76" height="76" rx="10"/>',
    triangle: '<path d="M50 8 L92 88 L8 88 Z" stroke-linejoin="round" stroke-width="8" stroke="white"/>',
    star:
      '<path d="M50 6 L62 38 L96 38 L68 59 L79 92 L50 71 L21 92 L32 59 L4 38 L38 38 Z"/>',
    diamond: '<path d="M50 6 L94 50 L50 94 L6 50 Z"/>',
    heart:
      '<path d="M50 88 C12 60 8 36 26 24 C40 15 50 28 50 34 C50 28 60 15 74 24 C92 36 88 60 50 88 Z"/>',
    hexagon: '<path d="M28 12 L72 12 L94 50 L72 88 L28 88 L6 50 Z"/>',
  };

  function shapeSVG(shape) {
    return (
      '<svg viewBox="0 0 100 100" fill="white" aria-hidden="true">' +
      SHAPES[shape] +
      "</svg>"
    );
  }

  /* ---------- Photo cards (optional) ----------
     If at least TOTAL_PAIRS images are available, the game uses photos
     instead of the colored shapes. The list comes from images/manifest.json
     (auto-generated on deploy from whatever is in the images/ folder), or
     from a manual window.MATCH_CARDS array. Falls back to shapes otherwise. */
  const IMAGES_DIR = "images/";
  let PHOTOS = []; // resolved image URLs, when in photo mode

  async function loadPhotos() {
    let list = Array.isArray(window.MATCH_CARDS) ? window.MATCH_CARDS : null;
    if (!list) {
      try {
        const res = await fetch(IMAGES_DIR + "manifest.json", {
          cache: "no-store",
        });
        if (res.ok) list = await res.json();
      } catch (e) {
        /* no manifest — stay in shape mode */
      }
    }
    if (Array.isArray(list)) {
      PHOTOS = list
        .filter((n) => typeof n === "string" && n.trim())
        .map((n) => (n.includes("/") ? n : IMAGES_DIR + n));
    }
  }

  function photoMode() {
    return PHOTOS.length >= TOTAL_PAIRS;
  }

  /* ---------- DOM refs ---------- */
  const $ = (sel) => document.querySelector(sel);
  const startScreen = $("#start");
  const gameScreen = $("#game");
  const form = $("#start-form");
  const nameInput = $("#name");
  const board = $("#board");
  const timerBar = $("#timer-bar");
  const hudName = $("#hud-name");
  const hudPairs = $("#hud-pairs");
  const hudTotal = $("#hud-total");
  const hudMoves = $("#hud-moves");
  const resultOverlay = $("#result");
  const resultTitle = $("#result-title");
  const resultMsg = $("#result-msg");
  const statTime = $("#stat-time");
  const statMoves = $("#stat-moves");
  const statBest = $("#stat-best");
  const againBtn = $("#again-btn");
  const changeBtn = $("#change-btn");
  const resultLbList = $("#result-lb-list");
  const resultLbScope = $("#result-lb-scope");
  const startLbBtn = $("#start-lb-btn");
  const lbOverlay = $("#leaderboard");
  const lbList = $("#lb-list");
  const lbScope = $("#lb-scope");
  const lbCloseBtn = $("#lb-close-btn");

  const SCOPE_LABEL = window.Leaderboard.isRemote ? "Global" : "This device";

  const TOTAL_PAIRS = PAIRS.length;
  hudTotal.textContent = String(TOTAL_PAIRS);

  /* ---------- Game state ---------- */
  let state;

  function freshState() {
    return {
      playerName: "",
      first: null, // first flipped card element
      lock: false, // input locked during compare / mismatch wait
      matched: 0,
      moves: 0,
      mismatchTimer: null,
      countdownTimer: null,
      endsAt: 0,
      lowFired: false,
      finished: false,
    };
  }

  /* ---------- Utilities ---------- */
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function fmtTime(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m + ":" + String(r).padStart(2, "0");
  }

  function bestKey(name) {
    return "match:best:" + name.trim().toLowerCase();
  }
  function getBest(name) {
    const v = localStorage.getItem(bestKey(name));
    return v ? Number(v) : null;
  }
  function setBest(name, seconds) {
    try {
      localStorage.setItem(bestKey(name), String(seconds));
    } catch (e) {
      /* storage may be unavailable (private mode) — ignore */
    }
  }

  /* ---------- Build board ---------- */
  // Choose TOTAL_PAIRS card faces for this round. In photo mode, pick a random
  // subset so games with more than 7 images stay varied.
  function pickPairs() {
    if (photoMode()) {
      return shuffle(PHOTOS.slice())
        .slice(0, TOTAL_PAIRS)
        .map((src) => ({ id: "img:" + src, image: src }));
    }
    return PAIRS.map((p) => ({ ...p }));
  }

  function buildDeck() {
    const deck = [];
    pickPairs().forEach((p) => {
      deck.push({ ...p });
      deck.push({ ...p });
    });
    return shuffle(deck);
  }

  function buildBoard() {
    board.innerHTML = "";
    const deck = buildDeck();

    // Preload this round's photos so flips reveal instantly.
    if (photoMode()) {
      new Set(deck.map((d) => d.image)).forEach((src) => {
        if (src) {
          const img = new Image();
          img.src = encodeURI(src);
        }
      });
    }

    let idx = 0;

    ROW_PATTERN.forEach((count) => {
      const row = document.createElement("div");
      row.className = "row";
      for (let i = 0; i < count; i++) {
        row.appendChild(makeCard(deck[idx++]));
      }
      board.appendChild(row);
    });

    sizeCards();
  }

  function makeCard(data) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "card";
    card.dataset.id = data.id;
    card.setAttribute("aria-label", "Face-down card");

    const inner = document.createElement("div");
    inner.className = "card-inner";

    const back = document.createElement("div");
    back.className = "card-back";

    const face = document.createElement("div");
    face.className = "card-face";
    if (data.image) {
      face.classList.add("card-face--photo");
      face.style.backgroundImage = 'url("' + encodeURI(data.image) + '")';
    } else {
      face.style.background = data.color;
      face.innerHTML = shapeSVG(data.shape);
    }

    inner.appendChild(back);
    inner.appendChild(face);
    card.appendChild(inner);

    // Green "matched" overlay — a real element on top of the card (NOT a
    // pseudo-element inside the 3D flip), so it renders reliably on iOS.
    const cover = document.createElement("div");
    cover.className = "card-cover";
    cover.setAttribute("aria-hidden", "true");
    card.appendChild(cover);

    card.addEventListener("click", () => onCardClick(card, data));
    return card;
  }

  /* ---------- Responsive card sizing (no scroll, big cards) ---------- */
  function sizeCards() {
    const rows = ROW_PATTERN.length;
    const maxPerRow = Math.max(...ROW_PATTERN);

    const styles = getComputedStyle(board);
    const padX =
      parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
    const padY =
      parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);

    const availW = board.clientWidth - padX;
    const availH = board.clientHeight - padY;

    const sizeByW = (availW - (maxPerRow - 1) * GAP) / maxPerRow;
    const sizeByH = (availH - (rows - 1) * GAP) / rows;

    const size = Math.max(48, Math.floor(Math.min(sizeByW, sizeByH)));
    document.documentElement.style.setProperty("--card-size", size + "px");
  }

  /* ---------- Card interaction ---------- */
  function onCardClick(card, data) {
    if (state.finished || state.lock) return;
    if (card.classList.contains("is-flipped")) return;
    if (card.classList.contains("is-matched")) return;

    flip(card, data);

    if (!state.first) {
      state.first = card;
      return;
    }

    // Second card of the move
    state.moves++;
    hudMoves.textContent = String(state.moves);

    const a = state.first;
    const b = card;

    if (a.dataset.id === b.dataset.id) {
      // Match!
      state.first = null;
      markMatched(a);
      markMatched(b);
      state.matched++;
      hudPairs.textContent = String(state.matched);
      if (state.matched === TOTAL_PAIRS) win();
    } else {
      // Mismatch — briefly lock, then flip both back
      state.lock = true;
      state.mismatchTimer = setTimeout(() => {
        unflip(a);
        unflip(b);
        state.first = null;
        state.lock = false;
      }, MISMATCH_DELAY);
    }
  }

  function flip(card, data) {
    card.classList.add("is-flipped", "is-pop");
    const label = data.image
      ? "photo card, face up"
      : data.color + " " + data.shape + " card, face up";
    card.setAttribute("aria-label", label);
    card.addEventListener(
      "animationend",
      () => card.classList.remove("is-pop"),
      { once: true }
    );
  }

  function unflip(card) {
    card.classList.remove("is-flipped");
    card.setAttribute("aria-label", "Face-down card");
  }

  function markMatched(card) {
    card.classList.add("is-matched");
    card.disabled = true;
  }

  /* ---------- Countdown ---------- */
  function startCountdown() {
    // Reset bar to full, then animate width to 0 over GAME_SECONDS.
    timerBar.classList.remove("is-low");
    timerBar.style.transition = "none";
    timerBar.style.width = "100%";
    // Force reflow so the transition restarts cleanly.
    void timerBar.offsetWidth;
    timerBar.style.transition = "width " + GAME_SECONDS + "s linear";
    timerBar.style.width = "0%";

    state.endsAt = Date.now() + GAME_SECONDS * 1000;
    state.lowFired = false;
    state.countdownTimer = setInterval(tickCountdown, 200);
  }

  function tickCountdown() {
    const remaining = (state.endsAt - Date.now()) / 1000;
    if (!state.lowFired && remaining <= GAME_SECONDS * 0.2) {
      state.lowFired = true;
      timerBar.classList.add("is-low"); // turn the bar warm/red near the end
    }
    if (remaining <= 0) {
      lose();
    }
  }

  function stopCountdown() {
    clearInterval(state.countdownTimer);
    // Freeze the bar where it is.
    const w = getComputedStyle(timerBar).width;
    timerBar.style.transition = "none";
    timerBar.style.width = w;
  }

  /* ---------- Win / lose ---------- */
  function timeElapsed() {
    return GAME_SECONDS - (state.endsAt - Date.now()) / 1000;
  }

  function win() {
    if (state.finished) return;
    state.finished = true;
    stopCountdown();

    const seconds = Math.max(0, timeElapsed());
    const prevBest = getBest(state.playerName);
    const isRecord = prevBest === null || seconds < prevBest;
    if (isRecord) setBest(state.playerName, seconds);
    const best = getBest(state.playerName);

    resultTitle.textContent = isRecord ? "New best! 🏆" : "You win! 🎉";
    resultMsg.textContent =
      "Great job, " + state.playerName + " — all pairs matched.";
    statTime.textContent = fmtTime(seconds);
    statMoves.textContent = String(state.moves);
    statBest.textContent = best !== null ? fmtTime(best) : "—";
    showResult();

    // Record the win on the leaderboard, then refresh the list.
    submitAndRefresh({
      name: state.playerName,
      seconds: Math.round(seconds * 100) / 100,
      moves: state.moves,
    });
  }

  function lose() {
    if (state.finished) return;
    state.finished = true;
    stopCountdown();
    state.lock = true;

    // Reveal remaining cards so the player sees the answers.
    board.querySelectorAll(".card:not(.is-matched)").forEach((c) => {
      c.classList.add("is-flipped");
      c.disabled = true;
    });

    const best = getBest(state.playerName);
    resultTitle.textContent = "Time's up! ⏳";
    resultMsg.textContent =
      "You matched " +
      state.matched +
      " of " +
      TOTAL_PAIRS +
      " pairs. You're gay!";
    statTime.textContent = fmtTime(GAME_SECONDS);
    statMoves.textContent = String(state.moves);
    statBest.textContent = best !== null ? fmtTime(best) : "—";
    showResult();

    // No score to submit on a loss — just show what there is to beat.
    renderLeaderboard(resultLbList, resultLbScope, {
      limit: 5,
      highlight: state.playerName,
    });
  }

  function showResult() {
    resultOverlay.hidden = false;
    againBtn.focus();
  }
  function hideResult() {
    resultOverlay.hidden = true;
  }

  /* ---------- Leaderboard UI ---------- */
  async function submitAndRefresh(score) {
    resultLbList.innerHTML = '<li class="lb-empty">Saving your time…</li>';
    resultLbScope.textContent = SCOPE_LABEL;
    try {
      await window.Leaderboard.submit(score);
    } catch (e) {
      /* keep going — we can still show the existing list */
    }
    renderLeaderboard(resultLbList, resultLbScope, {
      limit: 5,
      highlight: score.name,
    });
  }

  async function renderLeaderboard(listEl, scopeEl, opts) {
    const limit = opts.limit || 10;
    const highlight = (opts.highlight || "").trim().toLowerCase();
    if (scopeEl) scopeEl.textContent = SCOPE_LABEL;
    listEl.innerHTML = '<li class="lb-empty">Loading…</li>';

    let rows;
    try {
      rows = await window.Leaderboard.list();
    } catch (e) {
      listEl.innerHTML =
        '<li class="lb-empty">Couldn\'t load the leaderboard right now.</li>';
      return;
    }

    if (!rows.length) {
      listEl.innerHTML =
        '<li class="lb-empty">No times yet — be the first!</li>';
      return;
    }

    const myRank = rows.findIndex(
      (r) => String(r.name || "").trim().toLowerCase() === highlight
    );

    listEl.innerHTML = "";
    rows.slice(0, limit).forEach((r, i) => {
      listEl.appendChild(makeLbRow(i + 1, r, i === myRank));
    });

    // If the player ranked outside the visible top, show their row too.
    if (myRank >= limit) {
      const sep = document.createElement("li");
      sep.className = "lb-sep";
      sep.textContent = "···";
      listEl.appendChild(sep);
      listEl.appendChild(makeLbRow(myRank + 1, rows[myRank], true));
    }
  }

  function makeLbRow(rank, row, isMe) {
    const li = document.createElement("li");
    li.className = "lb-row" + (isMe ? " is-me" : "");
    const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "";
    li.innerHTML =
      '<span class="lb-rank">' +
      (medal || rank) +
      "</span>" +
      '<span class="lb-name"></span>' +
      '<span class="lb-time">' +
      fmtTime(row.seconds) +
      "</span>";
    li.querySelector(".lb-name").textContent = row.name || "—";
    return li;
  }

  function openLeaderboard() {
    lbOverlay.hidden = false;
    lbCloseBtn.focus();
    renderLeaderboard(lbList, lbScope, { limit: 10 });
  }
  function closeLeaderboard() {
    lbOverlay.hidden = true;
  }

  /* ---------- Flow control ---------- */
  function startGame(name) {
    if (state && state.mismatchTimer) clearTimeout(state.mismatchTimer);
    if (state && state.countdownTimer) clearInterval(state.countdownTimer);

    state = freshState();
    state.playerName = name;

    hudName.textContent = name;
    hudPairs.textContent = "0";
    hudMoves.textContent = "0";

    hideResult();
    startScreen.classList.remove("is-active");
    gameScreen.classList.add("is-active");

    buildBoard();
    // Wait one frame so layout settles before starting the countdown.
    requestAnimationFrame(() => requestAnimationFrame(startCountdown));
  }

  function goToStart() {
    if (state) {
      clearTimeout(state.mismatchTimer);
      clearInterval(state.countdownTimer);
    }
    hideResult();
    gameScreen.classList.remove("is-active");
    startScreen.classList.add("is-active");
    nameInput.focus();
    nameInput.select();
  }

  /* ---------- Events ---------- */
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.classList.add("shake");
      nameInput.addEventListener(
        "animationend",
        () => nameInput.classList.remove("shake"),
        { once: true }
      );
      nameInput.focus();
      return;
    }
    startGame(name);
  });

  againBtn.addEventListener("click", () => startGame(state.playerName));
  changeBtn.addEventListener("click", goToStart);

  startLbBtn.addEventListener("click", openLeaderboard);
  lbCloseBtn.addEventListener("click", closeLeaderboard);
  // Tap the dimmed backdrop to dismiss the leaderboard.
  lbOverlay.addEventListener("click", (e) => {
    if (e.target === lbOverlay) closeLeaderboard();
  });

  // Re-fit cards on resize / orientation change.
  let resizeRAF = null;
  window.addEventListener("resize", () => {
    if (!gameScreen.classList.contains("is-active")) return;
    cancelAnimationFrame(resizeRAF);
    resizeRAF = requestAnimationFrame(sizeCards);
  });

  // Discover photos (if any) before the first game starts.
  loadPhotos();

  // Pre-fill a remembered name for convenience.
  try {
    const last = localStorage.getItem("match:lastName");
    if (last) nameInput.value = last;
  } catch (e) {
    /* ignore */
  }
  form.addEventListener("submit", () => {
    try {
      localStorage.setItem("match:lastName", nameInput.value.trim());
    } catch (e) {
      /* ignore */
    }
  });
})();
