# Card photos

Drop your card images **in this folder** and they'll be used as the card faces.

## How to add or change photos

1. Add image files here (`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.avif` — mixing
   types is fine).
2. Commit/push (or just drag-and-drop them into this folder in the GitHub web UI
   and commit).
3. That's it. On deploy, `manifest.json` is regenerated automatically from
   whatever is in here, and the game starts using your photos.

## Good to know

- **Need at least 7 images** (the board has 7 pairs). With **more than 7**, each
  game randomly picks 7, so it stays fresh. With **fewer than 7**, the game
  safely falls back to the built-in colored shapes.
- **Any size/shape works.** Cards are square and images are cropped to fill from
  the center, so portrait or landscape both look fine. Roughly square photos
  crop the least.
- Smaller files load faster on phones. ~500–1000px on the long edge is plenty;
  no need for huge originals.
- `manifest.json` is auto-generated — you don't need to edit it by hand.
