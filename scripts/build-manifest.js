#!/usr/bin/env node
// Builds `manifest.json` and `last_updated.json` from the `assets/` folder.
//
// Convention (FLAT layout, name-first, multi-category):
//   assets/<name>__<cat1>[__<cat2>...].<audio_ext>   → track
//   assets/<name>.<image_ext>                        → thumbnail (paired by name)
//   assets/<name>.json                               → optional sidecar metadata
//   categories.json                                  → optional category metadata
//
// Filename rules:
//   - Single `_` becomes a space in both names and category labels.
//   - Double `__` separates fields. Everything before the first `__` is the
//     track name; every chunk after it is a category id.
//   - A track must have at least one category (i.e. at least one `__`).
//
// Examples:
//   brown_noise__noise.m4a             → "Brown Noise", categories: [noise]
//   day_raining__peace__rain__forest.mp3
//                                      → "Day Raining", categories: [peace, rain, forest]
//   brown_noise__noise_music.m4a       → "Brown Noise", categories: [noise music]
//   brown_noise.jpg                    → thumbnail for brown_noise__*.mp3
//   brown_noise.json                   → sidecar for brown_noise__*.mp3
//
// Output: v3 manifest. Categories listed once with metadata; tracks at the
// top level with `category_ids: []` so multi-category membership is just a
// list, not duplication.

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_OWNER = 'bimal-py';
const REPO_NAME = 'pomodoro_musics';
const RELEASE_TAG = 'musics';
const BASE_URL =
  `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${RELEASE_TAG}`;

const AUDIO_EXTS = new Set(['.m4a', '.mp3', '.ogg', '.wav', '.aac', '.opus', '.flac']);
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const ASSETS_DIR = 'assets';
const CATEGORIES_FILE = 'categories.json';
const FIELD_SEP = '__';

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.warn(`[warn] could not parse ${filePath}: ${err.message}`);
    return null;
  }
}

function prettify(slug) {
  return slug
    .replace(/_/g, ' ')
    .replace(/-+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function listAssets() {
  if (!fs.existsSync(ASSETS_DIR)) return [];
  return fs
    .readdirSync(ASSETS_DIR)
    .filter((name) => !name.startsWith('.') && !name.startsWith('_'))
    .sort();
}

function parseFilename(file) {
  const ext = path.extname(file).toLowerCase();
  const base = path.basename(file, path.extname(file));
  const parts = base.split(FIELD_SEP);
  return {
    ext,
    base,
    name: parts[0] || base,
    categoryIds: parts.slice(1).filter((p) => p.length > 0),
  };
}

const assets = listAssets();

const audios = [];
const imagesByName = new Map();
const sidecarsByName = new Map();

for (const file of assets) {
  const ext = path.extname(file).toLowerCase();
  const base = path.basename(file, path.extname(file));
  if (AUDIO_EXTS.has(ext)) {
    audios.push(file);
  } else if (IMAGE_EXTS.has(ext)) {
    if (!imagesByName.has(base)) imagesByName.set(base, file);
  } else if (ext === '.json') {
    const data = readJson(path.join(ASSETS_DIR, file));
    if (data) sidecarsByName.set(base, data);
  }
}

const tracks = [];
const referencedCategoryIds = new Set();
for (const file of audios) {
  const parsed = parseFilename(file);
  if (parsed.categoryIds.length === 0) {
    console.warn(
      `[warn] skipping "${file}" — no category. Use ` +
        `name__category.ext (e.g. brown_noise__noise.m4a).`,
    );
    continue;
  }
  const sidecar = sidecarsByName.get(parsed.name) || {};
  const thumbnail = imagesByName.get(parsed.name) || null;
  const stat = fs.statSync(path.join(ASSETS_DIR, file));
  const categoryIds = Array.isArray(sidecar.category_ids) && sidecar.category_ids.length > 0
    ? sidecar.category_ids
    : parsed.categoryIds;
  for (const id of categoryIds) referencedCategoryIds.add(id);
  const track = {
    id: sidecar.id || parsed.name,
    title: sidecar.title || prettify(parsed.name),
    file,
    category_ids: categoryIds,
    size_bytes: stat.size,
    duration_sec: Number.isFinite(sidecar.duration_sec)
      ? sidecar.duration_sec
      : 0,
    loop: sidecar.loop !== false,
    featured: sidecar.featured === true,
    premium: sidecar.premium === true,
  };
  if (thumbnail) track.thumbnail = thumbnail;
  tracks.push(track);
}

tracks.sort((a, b) => a.id.localeCompare(b.id));

const categoryMeta = readJson(CATEGORIES_FILE) || {};
const allCategoryIds = new Set([
  ...Object.keys(categoryMeta),
  ...referencedCategoryIds,
]);

const categories = Array.from(allCategoryIds)
  .filter((id) => referencedCategoryIds.has(id))
  .map((id) => {
    const meta = categoryMeta[id] || {};
    return {
      id,
      name: meta.name || prettify(id),
      icon: meta.icon || '🎵',
      order: Number.isFinite(meta.order) ? meta.order : 999,
    };
  })
  .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
  .map(({ order: _order, ...rest }) => rest);

const manifest = {
  version: 3,
  base_url: BASE_URL,
  categories,
  tracks,
};

const counts = {
  category_count: categories.length,
  track_count: tracks.length,
  featured_count: tracks.filter((t) => t.featured).length,
};

const lastUpdated = {
  updated_at: new Date().toISOString(),
  ...counts,
};

const writeIfChanged = (file, value) => {
  const next = JSON.stringify(value, null, 2) + '\n';
  const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : null;
  if (prev === next) {
    console.log(`[skip] ${file} unchanged`);
    return false;
  }
  fs.writeFileSync(file, next);
  console.log(`[write] ${file}`);
  return true;
};

const manifestChanged = writeIfChanged('manifest.json', manifest);
if (manifestChanged) {
  writeIfChanged('last_updated.json', lastUpdated);
} else {
  console.log(
    `[ok] ${counts.category_count} categories, ${counts.track_count} tracks, ${counts.featured_count} featured (no changes)`,
  );
}
