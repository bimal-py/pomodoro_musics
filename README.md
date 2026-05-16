# pomodoro_musics

Music library for the [Pomodoro Flutter app](https://github.com/bimal-py/pomodoro).
Drop audio files (and matching thumbnails) into `assets/` and push — CI does
the rest. The app streams them on demand and caches each track on first play.

> **TL;DR — to add a track:**
> drop `day_raining__peace__rain__forest.mp3` and `day_raining.jpg` into
> `assets/`, commit, push. The CI auto-publishes. The app picks it up on
> next launch.

---

## Naming convention — name first, then categories

There are **no subfolders**. Everything goes in `assets/`. The filename
encodes the track name **and** all the categories it belongs to.

**Format:** `<name>__<cat1>[__<cat2>__<cat3>...].<ext>`

- A single `_` becomes a **space** (in either the name or a category label).
- The double `__` separates **fields** — name from categories, and categories
  from each other.
- A track must have **at least one category** (one `__` in the filename).

**Examples:**

| Filename | Track name | Categories |
|---|---|---|
| `brown_noise__noise.m4a` | Brown Noise | `noise` |
| `brown_noise__noise_music.m4a` | Brown Noise | `noise music` |
| `day_raining__peace__rain__forest.mp3` | Day Raining | `peace`, `rain`, `forest` |
| `evening_crickets__nature__night.m4a` | Evening Crickets | `nature`, `night` |
| `lofi_focus_loop_1__lofi__study.mp3` | Lofi Focus Loop 1 | `lofi`, `study` |

A track shows up in **every** category it's tagged with. Same track, one
file, multiple sections.

### Thumbnails

The thumbnail filename is just the **name part** — no categories:

```
assets/day_raining__peace__rain__forest.mp3
assets/day_raining.jpg                ← paired by name
```

Image extensions supported: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`.

If you don't include a thumbnail, the app falls back to a colored gradient
with the first category's emoji.

### Sidecar metadata (optional)

The sidecar filename also uses just the **name part**:

```
assets/day_raining__peace__rain__forest.mp3
assets/day_raining.json
```

```json
{
  "title": "Day Raining (Soft)",
  "duration_sec": 180,
  "loop": true,
  "featured": true,
  "premium": false
}
```

Sidecar overrides are optional. Field defaults are listed below.

---

## How it works

```
                                                          ┌──────────────┐
   assets/<file>.{mp3|m4a|jpg|...} ──push──▶  Actions ──▶ │  Release     │
                                                 │        │  "musics"    │
                                                 │        │  (audio +    │
                                                 ▼        │   images)    │
                                          manifest.json   └──────┬───────┘
                                          last_updated.json      │
                                          (committed back)       │
                                                                 │
                                       ┌───────────────────┐     │
                                       │   Pomodoro app    │ ◀───┘
                                       │  (your phone)     │
                                       └───────────────────┘
                                  reads manifest.json on launch
                                  streams audio + image URLs from release
                                  caches each on disk after first play
```

---

## Repository layout

```
pomodoro_musics/
├── README.md
├── .gitignore
├── manifest.json             ← AUTO-GENERATED — don't edit by hand
├── last_updated.json         ← AUTO-GENERATED — don't edit by hand
├── categories.json           ← Optional: per-category display name + icon + sort order
├── scripts/
│   └── build-manifest.js     ← Reads assets/, generates the two files above
├── .github/
│   └── workflows/
│       └── publish.yml       ← Runs build + uploads everything to the release
└── assets/                   ← YOUR audio + thumbnails go here (flat, no subfolders)
    ├── brown_noise__noise.m4a
    ├── brown_noise.jpg
    ├── day_raining__peace__rain__forest.mp3
    ├── day_raining.png
    └── ...
```

---

## Adding a track — step by step

1. **Pick an audio file** you're allowed to host (see [Licensing](#licensing)).
2. **Compress** to AAC m4a around 96 kbps. A 5-minute loop ends up ~3 MB.
   ```sh
   ffmpeg -i raw.wav -c:a aac -b:a 96k assets/forest_birds__forest__nature.m4a
   ```
   - The name part is `forest_birds` (will display as "Forest Birds").
   - Categories: `forest`, `nature`.
3. **Add a thumbnail** (optional). Square ~600×600 works well.
   ```sh
   cp ~/Pictures/forest.jpg assets/forest_birds.jpg
   ```
4. **Commit and push**:
   ```sh
   git add assets/forest_birds__forest__nature.m4a assets/forest_birds.jpg
   git commit -m "music: add forest birds"
   git push
   ```
5. **Watch the Actions tab.** The `Publish Music` workflow regenerates the
   manifest, uploads the files to the `musics` release, and commits the
   manifest back to `main`.
6. **App picks it up** on next launch. Pull-to-refresh in the Relax tab if
   you want it immediately.

---

## Supported file extensions

**Audio:** `.m4a`, `.mp3`, `.ogg`, `.wav`, `.aac`, `.opus`, `.flac`
Stick to `.m4a` (AAC) for best cross-platform support and size.

**Thumbnails:** `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`
Animated GIFs work; keep them small (< 500 KB).

---

## Category metadata — `categories.json`

Maps category id → display name + icon + sort order. **All fields optional.**

```json
{
  "noise":  { "name": "Noise",   "icon": "🔊", "order": 1 },
  "rain":   { "name": "Rain",    "icon": "🌧️", "order": 2 },
  "forest": { "name": "Forest",  "icon": "🌳", "order": 3 },
  "ocean":  { "name": "Ocean",   "icon": "🌊", "order": 4 },
  "lofi":   { "name": "Lo-fi",   "icon": "🎧", "order": 5 }
}
```

The script:
- Auto-creates a category the moment any track references it.
- Drops any category from `categories.json` that no track currently uses (so
  the file stays clean of stale ids).
- Uses prettified id + 🎵 fallback when a category isn't in this file.

Category id with a space (e.g. `noise music`) — write it with `_` in the
filename: `__noise_music`. The display name auto-prettifies to "Noise Music".

---

## Per-track sidecar fields

| Field | Default | Purpose |
|---|---|---|
| `id` | name part of filename | Stable id used by `defaultMusicId`. **Don't rename in production** — users lose their setting. |
| `title` | name part, prettified | Display name shown on the card |
| `category_ids` | parsed from filename | Override the filename's categories with an explicit array |
| `duration_sec` | `0` | Shown in the UI. `0` hides it. |
| `loop` | `true` | Whether the app loops the track |
| `featured` | `false` | Pre-cached on first app launch. Mark ~6–10 small tracks featured. |
| `premium` | `false` | Display lock icon on the card (visual only — no gating yet) |

---

## Featured tracks — what to mark for first-launch precache

Mark **6–10 small** (< 5 MB) tracks `"featured": true`. On a user's first
app launch, the bootstrapper silently downloads all featured tracks so the
Relax tab feels populated.

The app hard-skips precaching any file over **20 MB** to keep cellular use
sane. Featured-but-huge files still work; they just download on explicit
tap.

---

## File sizes — what to aim for

| Bitrate | 5-min loop | When to use |
|---|---|---|
| AAC 64 kbps | ~2.4 MB | Plain ambient noise |
| AAC 96 kbps | ~3.6 MB | **Recommended default** |
| AAC 128 kbps | ~4.8 MB | Music with structure (lo-fi, piano) |
| AAC 192 kbps | ~7.2 MB | Detailed music |
| 320 kbps / WAV | 15–60+ MB | Don't — bloat without benefit on a phone speaker |

---

## Manifest format (v3)

```json
{
  "version": 3,
  "base_url": "https://github.com/bimal-py/pomodoro_musics/releases/download/musics",
  "categories": [
    { "id": "noise",  "name": "Noise",  "icon": "🔊" },
    { "id": "rain",   "name": "Rain",   "icon": "🌧️" },
    { "id": "forest", "name": "Forest", "icon": "🌳" }
  ],
  "tracks": [
    {
      "id": "day_raining",
      "title": "Day Raining",
      "file": "day_raining__peace__rain__forest.mp3",
      "thumbnail": "day_raining.jpg",
      "category_ids": ["peace", "rain", "forest"],
      "size_bytes": 4194304,
      "duration_sec": 180,
      "loop": true,
      "featured": true,
      "premium": false
    }
  ]
}
```

Categories and tracks are separate top-level lists. A track belongs to
multiple categories via `category_ids` — no duplication. The app filters
the tracks list by selected category id.

`last_updated.json`:

```json
{
  "updated_at": "2026-05-16T04:08:07.514Z",
  "category_count": 5,
  "track_count": 23,
  "featured_count": 8
}
```

---

## Running the build locally

```sh
node scripts/build-manifest.js
```

Idempotent — only rewrites `last_updated.json` when `manifest.json` actually
changed. Run it any time to preview what CI will publish.

---

## Capacity & limits

- **Per-file:** GitHub allows 2 GB per release asset.
- **Total:** unlimited release assets.
- **100 tracks × 5 MB ≈ 500 MB** — totally fine.
- **App-side cache:** ~500 MB on-device, LRU eviction.
- **Hard precache cap:** the app skips precaching anything over **20 MB**.
- **CI runtime:** ~10–20 s per file. With `--clobber`, re-uploads replace
  in place.

---

## Licensing

Every file you commit ends up in a **public release**. Only upload audio
you have the right to redistribute.

**Safe sources:**

- [Pixabay Music](https://pixabay.com/music/) — CC0
- [freesound.org](https://freesound.org) — mostly CC0/CC-BY
- [FreePD](https://freepd.com) — public domain
- [YouTube Audio Library](https://youtube.com/audiolibrary) — royalty-free
- Recordings you made yourself

**Don't host:**

- Music from streaming services (Spotify, Apple Music)
- Tracks ripped from other apps' APKs/IPAs
- Anything you wouldn't show the original creator

A DMCA takedown here doesn't only delete files — it flags the GitHub
account.

---

## Troubleshooting

**Pushed but the app doesn't see the new track.**
- Actions tab — did the workflow succeed?
- Open `https://raw.githubusercontent.com/bimal-py/pomodoro_musics/main/manifest.json`
  — is the new track listed?
- In the app's Relax tab, pull-to-refresh (⟳ icon top-right).

**Track ignored with a "no category" warning.**
- The filename has no `__`. Use `name__category.ext`.
  e.g. `brown_noise__noise.m4a`.

**Audio downloads but plays as silence.**
- Test the file in VLC from its release URL.
- If VLC plays it but the app doesn't, re-encode to AAC m4a:
  `ffmpeg -i input.flac -c:a aac -b:a 96k output.m4a`

**Thumbnail doesn't show.**
- Basename match? `day_raining__rain.mp3` ↔ `day_raining.jpg`.
- Extension supported? `.jpg .jpeg .png .gif .webp`.

**Workflow failed: "release musics not found".**
- Workflow auto-creates on first run. If creation failed, create the
  release manually: Releases → "Draft a new release" → tag `musics` →
  publish. Then re-run the workflow.

**I want to remove a track.**
- `git rm assets/<file>.*` and push. Manifest re-emits without it; the app
  forgets it.
- The orphaned release asset isn't auto-deleted. Edit the release on
  GitHub to remove the file if you want.

---

## What this repo isn't

- **Not a CDN at scale.** Fine for hobby / launch quality. At meaningful
  traffic, migrate to Cloudflare R2 or Firebase Storage. Change `base_url`
  in `scripts/build-manifest.js`.
- **Not source-of-truth for production.** For a paid app, host audio
  behind a real CDN with proper auth.
