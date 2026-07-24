import { reactive, computed } from 'vue';
import { FONTS, fontStack } from './fonts.js';

/**
 * App-level font store.
 *
 * A CMS embeds the editor on many pages. Uploading a font on the font manager
 * page has to make it usable in every one of them, including editors that are
 * already mounted — so the catalogue lives here, once per app, and each editor
 * instance reads from it rather than owning a copy.
 *
 * The store never talks to a specific backend: `transport` is injected, so the
 * same store works against a REST endpoint, a GraphQL client, or an in-memory
 * stub in tests.
 */

/** Magic bytes. Extensions lie; the first four bytes do not. */
const SIGNATURES = [
  { format: 'woff2', bytes: [0x77, 0x4f, 0x46, 0x32] }, // wOF2
  { format: 'woff', bytes: [0x77, 0x4f, 0x46, 0x46] },  // wOFF
  { format: 'otf', bytes: [0x4f, 0x54, 0x54, 0x4f] },   // OTTO
  { format: 'ttf', bytes: [0x00, 0x01, 0x00, 0x00] },
  { format: 'ttf', bytes: [0x74, 0x72, 0x75, 0x65] }    // true
];

export async function sniffFormat(file) {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const hit = SIGNATURES.find((s) => s.bytes.every((b, i) => head[i] === b));
  return hit?.format ?? null;
}

/**
 * Ask the browser to parse the font.
 *
 * Cheaper and far more reliable than inspecting tables by hand: if FontFace
 * rejects it, the TV's WebView would have rejected it too, and the operator
 * finds out now instead of when the screen is already live.
 */
export async function validateFontFile(file, { maxBytes = 2 * 1024 * 1024 } = {}) {
  if (file.size > maxBytes) {
    return { ok: false, error: `File is ${(file.size / 1024).toFixed(0)} KB; the limit is ${maxBytes / 1024} KB. Subset it to Latin first.` };
  }

  const format = await sniffFormat(file);
  if (!format) {
    return { ok: false, error: 'Not a font file — expected woff2, woff, ttf or otf.' };
  }
  if (format === 'ttf' || format === 'otf') {
    // Not fatal: the CMS converts on upload. Worth saying out loud, though —
    // a .ttf is roughly 40% larger over the wire than the woff2 of the same face.
    // (surfaced as a warning, not an error)
  }

  const buffer = await file.arrayBuffer();
  try {
    const probe = new FontFace('__sv_probe__', buffer);
    await probe.load();
  } catch (err) {
    return { ok: false, error: `The browser could not parse this font: ${err.message}` };
  }

  return {
    ok: true,
    format,
    warning: format === 'ttf' || format === 'otf'
      ? 'Uploaded as ' + format + '. Converting to woff2 server-side cuts roughly 40% off the transfer.'
      : null
  };
}

/** REST transport matching the documented API shape. */
export function createRestTransport({ endpoint = '/api/fonts', fetchImpl = fetch } = {}) {
  const json = async (res) => {
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  };
  return {
    list: () => fetchImpl(endpoint).then(json),
    upload: (file, meta) => {
      const body = new FormData();
      body.append('file', file);
      for (const [key, value] of Object.entries(meta)) body.append(key, value);
      return fetchImpl(endpoint, { method: 'POST', body }).then(json);
    },
    remove: (id) => fetchImpl(`${endpoint}/${encodeURIComponent(id)}`, { method: 'DELETE' }).then(json)
  };
}

export function createFontStore({
  transport,
  /** Fonts that are always present and cannot be removed. */
  standard = FONTS,
  /** Where uploaded files are served from, prefixed onto each face's `file`. */
  remoteBase = '',
  /** Load the catalogue as soon as the store is created. */
  autoLoad = true
} = {}) {
  const state = reactive({
    uploaded: [],
    loading: false,
    error: null,
    ready: false
  });

  /** Everything an editor may offer: standard first, uploads after. */
  const catalog = computed(() => [...standard, ...state.uploaded]);

  async function refresh() {
    if (!transport?.list) {
      state.ready = true;
      return;
    }
    state.loading = true;
    state.error = null;
    try {
      const rows = await transport.list();
      state.uploaded = rows.map(normalise);
      state.ready = true;
    } catch (err) {
      state.error = err.message;
    } finally {
      state.loading = false;
    }
  }

  /**
   * Upload one face.
   *
   * The file is registered with the document before the request completes, so
   * the operator can pick the font immediately instead of waiting on a round
   * trip — and if the upload then fails, the preview is withdrawn again.
   */
  async function upload(file, { family, label, weight = 400, style = 'normal', fallback = 'sans-serif' }) {
    const check = await validateFontFile(file);
    if (!check.ok) throw new Error(check.error);

    const preview = await addPreviewFace(file, family, weight, style);

    try {
      if (!transport?.upload) {
        // No backend wired: keep it as a session-only font so the editor is
        // still usable in a demo or a test.
        state.uploaded.push(normalise({
          id: `local-${family}-${weight}-${style}`,
          label: label || family,
          family,
          fallback,
          source: 'remote',
          local: true,
          faces: [{ file: '', weight, style }]
        }));
        return { local: true, warning: check.warning };
      }

      const row = await transport.upload(file, { family, label: label || family, weight, style, fallback });
      mergeFamily(normalise(row));
      return { ...row, warning: check.warning };
    } catch (err) {
      preview?.remove();
      throw err;
    }
  }

  async function remove(id) {
    if (transport?.remove) await transport.remove(id);
    state.uploaded = state.uploaded.filter((f) => f.id !== id);
  }

  /** Merge a returned family into the list, replacing any earlier revision. */
  function mergeFamily(font) {
    const index = state.uploaded.findIndex((f) => f.id === font.id || f.family === font.family);
    if (index === -1) state.uploaded.push(font);
    else state.uploaded[index] = mergeFaces(state.uploaded[index], font);
  }

  function normalise(row) {
    return {
      fallback: 'sans-serif',
      source: 'remote',
      ...row,
      label: row.label ?? row.family,
      faces: (row.faces ?? []).map((f) => ({ weight: 400, style: 'normal', ...f }))
    };
  }

  if (autoLoad) refresh();

  return {
    state,
    catalog,
    remoteBase,
    refresh,
    upload,
    remove,
    isStandard: (font) => standard.some((s) => s.family === font.family)
  };
}

function mergeFaces(existing, incoming) {
  const faces = [...existing.faces];
  for (const face of incoming.faces) {
    const i = faces.findIndex((f) => f.weight === face.weight && f.style === face.style);
    if (i === -1) faces.push(face);
    else faces[i] = face;
  }
  return { ...existing, ...incoming, faces };
}

/**
 * Register a not-yet-uploaded file with the document so every mounted editor
 * can render it right away. Returns a handle that undoes it.
 */
async function addPreviewFace(file, family, weight, style) {
  if (typeof FontFace === 'undefined' || !document.fonts) return null;
  try {
    const face = new FontFace(family, await file.arrayBuffer(), {
      weight: String(weight),
      style
    });
    await face.load();
    document.fonts.add(face);
    return { remove: () => document.fonts.delete(face) };
  } catch {
    return null;
  }
}

/** Injection key shared by the Vue plugin and the editor component. */
export const FONT_STORE_KEY = Symbol('smartivFontStore');
