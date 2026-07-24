# @smartiv/html-editor

A self-contained HTML editor plugin for Vue 3, built for Android TV signage
output. No TinyMCE, no CKEditor, no third-party editor runtime — the core,
the plugins and the sanitizer are all written here.

The TinyMCE checkout in `../reference-tinymce` is architectural reference only
(plugin registry + command table), never a dependency.

---

## Why not an off-the-shelf editor

| Signage requirement | Generic editor | This editor |
|---|---|---|
| `Event:` / `Host:` / `Time:` with colons on one line | operators pad with spaces, never lines up | **Field List** block, colon placed by CSS grid |
| Text colour must survive a background change | colour and theme fight each other | colour is inline and independent of the theme |
| Output rendered by an Android TV WebView | needs external CSS and web fonts | one file, inline CSS, zero network requests |
| TV overscan crops 5% of every edge | no such concept | safe area + 1920×1080 preview |
| Readable from three metres | mixed px units | `rem` scale driven by a single root font-size |
| Bundle | 500 KB+ | ~16 KB gzipped, no runtime dependency |

---

## Install

```bash
npm install
npm run dev      # demo on http://localhost:5177
npm run build    # library bundle into dist/
```

## Use in Vue 3

```js
import { createApp } from 'vue';
import SmartivEditorPlugin from '@smartiv/html-editor';
import '@smartiv/html-editor/style.css';

createApp(App).use(SmartivEditorPlugin).mount('#app');
```

```vue
<template>
  <SmartivEditor
    v-model="html"
    v-model:theme="theme"
    min-height="420px"
    @export="saveToCms"
  />
</template>

<script setup>
import { ref } from 'vue';
const html = ref('');
const theme = ref('light');
function saveToCms({ html }) { /* POST to the API */ }
</script>
```

Without `app.use`, import the component directly:

```js
import { SmartivEditor } from '@smartiv/html-editor';
```

### Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `modelValue` | String | `''` | content HTML (v-model) |
| `theme` | String | `'light'` | background theme name (`v-model:theme`) |
| `plugins` | Array | `defaultPlugins` | plugin factories |
| `toolbar` | Array | `defaultToolbar` | groups of registered button names; `compactToolbar` also ships |
| `options` | Object | `{}` | editor options plus `options.tv` for export |
| `tvSurface` | Boolean | `true` | paint the editing surface with the TV background |
| `readonly` | Boolean | `false` | |
| `minHeight` / `maxHeight` | String | `320px` / `60vh` | |
| `dark` | Boolean | `false` | editor chrome theme (not the document theme) |

### Events

`update:modelValue`, `update:theme`, `change`, `init` (hands over the `Editor`
instance), `export`.

### Methods (via `ref`)

`getEditor()`, `getContent({ format: 'html' | 'text' })`, `setContent(html)`,
`exportTv()`.

---

## The colon problem — and the fix

In a plain rich-text editor `Event: …` is one run of text. The colon sits at the
end of the label, so its x position follows the label's length, and every row
lands somewhere different. Padding with spaces does not help: the font is
proportional.

The Field List splits label and value into two grid columns and renders the
colon as generated content pushed to the label column's edge:

```html
<dl class="sv-fields" data-sv-colon="align">
  <dt>Event</dt><dd>Coordination &amp; Technical Briefing</dd>
  <dt>Host</dt><dd>Media Team</dd>
  <dt>Time</dt><dd>14.00 – 16.00</dd>
</dl>
```

```css
.sv-fields   { display: grid; grid-template-columns: var(--sv-label-width, max-content) 1fr; }
.sv-fields > dt         { display: flex; justify-content: space-between; }
.sv-fields > dt::after  { content: ":"; }
```

The label column is as wide as the longest label, and `space-between` pushes the
colon to that column's edge — so every colon shares one x coordinate regardless
of label length.

`data-sv-colon` modes:

| Value | Result |
|---|---|
| `align` | labels flush left, colons aligned **(default)** |
| `right` | labels right-aligned, colon trails the text |
| `tight` | colon hugs the label (the un-aligned legacy look) |
| `none` | no colon |

Lock the column with `--sv-label-width` (toolbar: *Label width*) when several
screens must share an identical label column.

### Keyboard inside a Field List

| Key | Action |
|---|---|
| `Tab` | label → value → next row (creates one at the end) |
| `Shift+Tab` | backwards |
| `Enter` | new row; on an empty row, leaves the list |
| `Backspace` in an empty label | delete the row |

A colon typed manually at the end of a label is stripped so it never doubles up.

---

## Background theme

Default is **neutral white with black text**. Operators switch it from the
*Background* select, the ◐ button, or `Ctrl/Cmd+Shift+L`.

| Name | Background | Text |
|---|---|---|
| `light` | `#ffffff` | `#14181d` **(default)** |
| `paper` | `#f4f1ea` | `#1a1815` |
| `dark` | `#0f1216` | `#f2f5f8` |
| `midnight` | `#0b1a2b` | `#eaf2fb` |
| `brand` | Smartiv blue gradient | `#ffffff` |

The theme is document state, not per-selection formatting: one value drives the
editing surface, the preview and the exported file.

```vue
<SmartivEditor v-model="html" v-model:theme="theme" />
```

Store `theme` alongside the HTML and pass it back on load, or pin it from the
host with `:theme="'dark'"`.

Each preset also carries `--sv-rule` and `--sv-rule-soft` (panel dividers, table
borders) so they stay visible on light and dark alike — without `color-mix()`,
which is not guaranteed on older Android TV WebViews.

Custom theme:

```js
import { THEMES } from '@smartiv/html-editor';

THEMES.hospital = {
  text: 'Hospital green',
  background: '#f2f8f5',
  color: '#0f2a1e',
  rule: 'rgba(0,0,0,.16)',
  ruleSoft: 'rgba(0,0,0,.05)'
};
```

---

## Text colour is independent of the background

The theme only sets the document default. An explicit colour is written as an
inline style on a `<span>`, which outranks the theme in the cascade:

```html
<dd><span style="color: #ffffff">Media Team</span></dd>
```

Consequences, all intended:

- White text stays white after switching the background to `light`, and black
  text stays black after switching to `dark`. The two settings never overwrite
  each other.
- The colour travels inside the HTML, so it reaches the Android TV document
  exactly as authored — no extra column, no second payload.
- *Clear* (in the colour popup) removes the inline colour and hands the run back
  to the theme default. It does not paint a colour on top.

The popup offers preset swatches plus a native colour input for any hex value.
Highlight colour (`background-color`) works the same way.

---

## Panel layout

One panel is the default. The *Columns* select turns the same block into 2 or 3
columns without retyping the content:

```html
<div class="sv-panels" data-sv-columns="1">
  <div class="sv-panel">
    <h1 class="sv-panel__title">MEETING IN PROGRESS</h1>
    <dl class="sv-fields" data-sv-colon="align">…</dl>
  </div>
</div>
```

Reducing the column count removes the rightmost panel and its content.

---

## Coexisting with Quill during the transition

The editor stamps every document it saves:

```html
<div class="sv-doc" data-sv-doc="1"> … </div>
```

The number is the format version, so a future change is detectable rather than
guessed. The wrapper is a plain unstyled div — a player that knows nothing about
it renders straight through.

It never enters the editing DOM. `getContent()` adds it, `setContent()` removes
it, so selection, normalisation and undo keep working against a flat list of
blocks. Deleting it by hand in HTML source mode is harmless: it comes back on
the next save. Set `options.documentMarker: false` to store bare fragments.

```js
import { isSmartivHtml, documentVersion } from '@smartiv/html-editor';

isSmartivHtml(row.html)     // false for Quill content
documentVersion(row.html)   // 1 for Smartiv, 0 for Quill
```

`HtmlView.kt` reads the same marker and picks the stylesheet from it, falling
back to a class-name check for Smartiv content saved before the marker existed.
Drop that fallback once no unmarked content is left.

Why not just look for `sv-fields`: a Smartiv document that happens to be a plain
paragraph carries no Smartiv class at all, and the heuristic would misfile it as
Quill. The marker is on every document regardless of what is inside it.

### The combination to watch

|  | Old player | New player |
|---|---|---|
| **Quill content** | works today | handled — `body.legacy` + the Quill rules |
| **Smartiv content** | **breaks** — no tv.css, so field lists stack and colons vanish | handled |

Only the bottom-left cell is a problem, and it is the normal state of a
transition: the CMS is one deployment, the player fleet updates gradually. Ship
the new player first and let the fleet fill up before authoring any Smartiv
content — or emit self-contained inline styles so the content renders with no
external CSS at all.

## Images are not supported — by design

There is no image button, and images cannot be introduced through any other
route either. The sanitizer drops `img`, `picture`, `source`, `svg`, `canvas`,
`video`, `audio`, `figure` and `figcaption` outright, rejects `data:` URLs, and
allows no `background-image` in inline styles. Pasting or dropping an image file
is refused with a message in the status bar rather than silently swallowed.

The reasoning:

- A signage player is regularly offline or behind a captive portal. A remote
  image becomes a broken icon and a reflow in the middle of a rotation.
- An inlined image inflates the document by a third (base64 is 4/3) and pushes
  the row past SQLite's 2 MB `CursorWindow` limit, which throws
  `SQLiteBlobTooBigException` on read.
- Base64 cannot be cached separately: changing one character of text re-syncs
  the whole payload.

Screen artwork belongs in the player's own asset pipeline — served locally via
`WebViewAssetLoader` and composed underneath or beside the WebView — not inside
operator-authored HTML.

---

## Android TV output

`exportTv()` produces one complete HTML document: inline CSS, no external fonts
or scripts, `<meta viewport width=1920>`.

```js
import { buildDocument } from '@smartiv/html-editor';

const html = buildDocument(contentHtml, {
  title: 'Smartiv Room Display',
  background: '#ffffff',
  color: '#14181d',
  rootFontSize: '16px',   // 1080p; lower it for 720p panels
  safeArea: '5%'
});
```

**Send the exported document, not the stored fragment.** `modelValue` is the
editing fragment: its colons come from `dt::after` and its layout from the
stylesheet. Hand that fragment straight to a WebView and the labels stack, the
values indent, and every colon disappears. Two supported ways to render:

```js
// A. store the fragment, wrap it at render time
const page = buildDocument(row.html, { ...resolveTheme(row.theme) });

// B. store the finished document, produced by the editor's export button
```

As a safety net, `buildDocument()` bakes each colon into the markup as
`<span class="sv-colon">:</span>` and marks the list `data-sv-colon-baked`, so
the generated colon stands down and there is never a double. If the stylesheet
goes missing anyway, the screen still reads `Event: Coordination & …` instead of
losing the separator. Load the fragment back into the editor and it un-bakes
itself automatically.

Device notes:

- **Safe area** — consumer TVs crop up to 5% per edge. Content sits inside
  `.sv-tv__safe` with `--sv-safe-area` padding; the ⛶ button draws the boundary
  in the preview.
- **Scale** — every size is in `rem`. A 720p panel only needs a different
  `rootFontSize`; the stylesheet also steps down below 1366px.
- **Fonts** — system fonts only. A web font that fails to load on an offline
  device reflows the screen mid-rotation.
- **No network** — the exported document issues no requests at all.

### Font manager — uploads shared across the whole CMS

A CMS embeds the editor on many pages. The font catalogue therefore lives in one
app-level store, not per instance: a font uploaded on the Fonts page becomes
selectable in every editor, **including ones already mounted on other routes**,
with no reload.

```js
import SmartivEditorPlugin, { createFontStore, createRestTransport } from '@smartiv/html-editor';

app.use(SmartivEditorPlugin, {
  fonts: createFontStore({
    transport: createRestTransport({ endpoint: '/api/fonts' }),
    remoteBase: '/fonts/'
  })
});
```

```vue
<!-- the separate Fonts page -->
<SmartivFontManager />

<!-- every editor picks the catalogue up on its own -->
<SmartivEditor v-model="html" @update:fonts="fonts = $event" />
```

`@update:fonts` reports the families that screen actually uses — store it on the
row so the player can warm its cache before the screen is due.

**Backend contract.** `GET /api/fonts` returns the uploaded families; standard
fonts are added by the store and never come from the API:

```json
[{ "id": 7, "label": "Brand Sans", "family": "Brand Sans",
   "fallback": "sans-serif", "source": "remote",
   "faces": [{ "file": "a3f9.woff2", "weight": 400 },
             { "file": "b71c.woff2", "weight": 700 }] }]
```

`POST /api/fonts` takes multipart `file` plus `family`, `label`, `weight`,
`style`, `fallback`, and returns one such row. `DELETE /api/fonts/{id}` removes
a family. `file` is resolved against `remoteBase`.

Without a `transport` the store still works: uploads are registered with the
document and stay for the session. Useful for demos and tests.

**Client-side validation before anything is sent:** size cap (2 MB by default),
magic-byte sniffing — a PDF renamed `.woff2` is rejected — and an actual
`FontFace` parse, so a file the TV's WebView would refuse is caught while the
operator is still at the keyboard. A `.ttf`/`.otf` upload is accepted with a
warning that converting to woff2 server-side saves roughly 40%.

The family name is whatever `@font-face` declares; it does **not** have to match
the name inside the file. It does have to be unique, and it is written into
saved content, so renaming it later orphans screens already using it.

### Bundled fonts

Every font is declared once, in [`src/fonts.js`](src/fonts.js). That registry
feeds three places at build time:

- the editor's **Font** dropdown,
- the `@font-face` block injected into the editing surface (pass
  `options.fontBaseUrl` so the CMS serves the same `.ttf` files and the operator
  previews the real face),
- `dist/smartiv-fonts.css`, read by the player from
  `assets/smartiv/fonts.css` — it carries both the `@font-face` rules and the
  `.ql-font-*` classes legacy Quill content depends on.

Adding a font later:

```js
// src/fonts.js
{ id: 'georgia', label: 'Georgia', family: 'Georgia', file: 'Georgia.ttf', fallback: 'serif' }
```

```bash
npm run build
cp dist/smartiv-fonts.css app/src/main/assets/smartiv/fonts.css
# drop Georgia.ttf into app/src/main/assets/fonts/
```

No Kotlin change, and the dropdown can only ever offer faces the player has.
`family` must match the `@font-face` name exactly — it is the string stored
inline in existing HTML, so renaming it orphans old content.

### Rendering inside an existing Compose player

If the app already wraps stored fragments in its own document (the usual Quill
setup), use [`android/HtmlView.kt`](android/HtmlView.kt) — a drop-in replacement
that keeps legacy Quill content rendering exactly as before while adding the
Smartiv path:

```bash
npm run build
cp dist/smartiv-tv.css app/src/main/assets/smartiv/tv.css
```

```kotlin
HtmlView(
    htmlContent = screen.html,
    theme = screen.theme,       // "light" | "paper" | "dark" | "midnight" | "brand"
    rootFontSize = 16.sp,       // 1080p; ~13.sp for 720p panels
    safeArea = "5%"             // only if this view is full-bleed
)
```

`body` gets `class="sv-tv"` and the content is wrapped in `.sv-tv__safe` when the
HTML carries the editor's hooks (`sv-fields` / `sv-panels`); otherwise it falls
through to `body.legacy` and the Quill rules. The two stylesheets never collide
because the legacy `body` block is scoped to that class.

### Raw WebView

```kotlin
webView.settings.javaScriptEnabled = false
webView.settings.textZoom = 100     // don't let TV font scaling distort the rem scale

// Explicit themes must not be inverted by algorithmic darkening
if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
    WebSettingsCompat.setAlgorithmicDarkeningAllowed(webView.settings, false)
}

webView.setBackgroundColor(themeBackgroundColor(screen.theme))  // avoid a white flash
webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null)
```

Browser support of the emitted CSS: Grid and custom properties (Chrome 49–57),
`column-gap` on grid (66), and `overflow-wrap: anywhere` (80) with
`word-break: break-word` as the fallback. `color-mix()` is not used.

---

## Architecture

```
src/
  core/
    Editor.js        instance: command table, UI registry, selection, event bus
    selection.js     caret/selection helpers scoped to the editor root
    history.js       undo stack over HTML snapshots
    sanitize.js      tag/attribute/CSS whitelist, no dependency
    EventBus.js
  plugins/           one file per feature, all optional
    inline, blocks, align, lists, typography,
    fieldList,       ← the label:value block
    theme,           ← light/dark background presets
    link, table, history, sourceView, tv
  ui/                Vue layer: Toolbar, ToolbarItem, EditorDialog, TvPreview
  styles/
    tvCss.js         content stylesheet (editor surface AND exported file)
    editor.css       editor chrome
  presets.js         defaultPlugins, defaultToolbar, compactToolbar
```

Plugins never touch Vue. They register commands and toolbar items; the Vue
components render whatever ended up in the registry.

### Writing a plugin

```js
export function watermarkPlugin(editor) {
  editor.addCommand('watermark', () => {
    const el = document.createElement('p');
    el.className = 'sv-watermark';
    el.textContent = 'SMARTIV';
    editor.selection.insert(el);
    return true;
  });

  editor.ui.addButton('watermark', {
    icon: '©',
    label: 'Watermark',
    command: 'watermark',
    active: () => !!editor.selection.closest((n) => n.classList?.contains('sv-watermark'))
  });
}
watermarkPlugin.pluginName = 'watermark';
```

```vue
<SmartivEditor
  :plugins="[...defaultPlugins, watermarkPlugin]"
  :toolbar="[...defaultToolbar, ['watermark']]"
/>
```

`editor` API: `addCommand`, `execCommand`, `native`, `queryState`, `queryValue`,
`addShortcut`, `ui.addButton/addSelect/addColor/addSeparator`, `selection.*`,
`events.on/emit`, `getContent`, `setContent`, `history`.

---

## Security

Everything passes through `sanitizeHtml()` on both read and write:

- tags outside the whitelist are unwrapped (their text survives)
- media tags are dropped whole, along with `script`, `iframe`, `object`,
  `embed`, `link` and `meta`
- `on*` attributes are stripped; `href` must match a safe URL pattern; `data:`
  URLs are rejected entirely
- inline styles are limited to a property whitelist; `url()`, `expression()` and
  `javascript:` are refused
- `target="_blank"` always gets `rel="noopener noreferrer"`

This matters because the result is executed by a WebView on the signage device.

---

## Status

Working: inline formatting, blocks/headings, alignment, lists, typography with
independent text and highlight colour, field lists, light/dark background
themes, 1–3 column panels, tables, links, undo/redo, HTML source mode, 1080p TV
preview with safe area, standalone export.

Not included: images (deliberately — see above), find & replace, D-pad
navigation inside the editor (the editor runs in the desktop CMS, not on the TV).
