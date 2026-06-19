# Match! 🎴

A mobile-first **memory / concentration** game. Type your first name, flip the
cards, find all the pairs before the countdown runs out. No sign-up — anyone
can play in seconds. Built as a single static site (plain HTML/CSS/JS, no build
step), so it's easy to host and share with friends.

## How to play

1. Type your first name and tap **Play**.
2. Tap a card — it pops and flips over to reveal a bold colored shape.
3. Tap a second card. If the two match, they stay revealed. If not, they flip
   back.
4. Match all **7 pairs** before the countdown line at the bottom shrinks to
   zero. Win and your best time is saved on your device.

## Design notes

- **Staggered board:** rows alternate **4, 3, 4, 3 cards** (14 total = 7 pairs)
  for a layout that's a little different from a plain grid. The 3-card rows are
  centered, giving an offset look.
- **Cards fill the screen:** card size is computed in JS so the whole board fits
  any phone with no scrolling, with the biggest possible tap targets.
- **Tap feedback:** cards scale up slightly then settle back when tapped, plus a
  3D flip.
- **Countdown line:** a horizontal bar spanning the full screen width that
  shrinks over the game (90 seconds), turning warm/red near the end.
- **Accessible:** each pair is a unique **color *and* shape** (colorblind
  friendly), large hit areas, `prefers-reduced-motion` support, and ARIA labels.

## Tuning

Open `game.js` and edit the config block at the top:

| Constant         | Default        | Meaning                                  |
| ---------------- | -------------- | ---------------------------------------- |
| `ROW_PATTERN`    | `[4, 3, 4, 3]` | Cards per row. Total **must be even**.   |
| `GAME_SECONDS`   | `90`           | Length of the countdown.                 |
| `MISMATCH_DELAY` | `850`          | ms a mismatched pair stays visible (ms). |

Add more pairs by adding entries to the `PAIRS` array (and a matching entry in
`SHAPES`), then make sure `ROW_PATTERN` sums to twice the number of pairs.

## Run locally

It's a static site, so just open `index.html` in a browser. For the best result
(so `localStorage` works on a proper origin) serve it:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Hosting on GitHub Pages

A workflow at `.github/workflows/deploy.yml` deploys the site automatically.

1. Push to the `main` branch.
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub
   Actions**.
3. Each push to `main` publishes the site; the live URL appears in the Actions
   run and on the Pages settings screen.

Then share that URL with your friends and play!
