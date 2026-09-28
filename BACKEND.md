# Backend guide — font upload storage & API

This document is for the **backend team** integrating the Smartiv HTML Editor
into a CMS. It describes the database mapping and the HTTP contract the editor
expects so an operator can upload their own fonts and have them render on the
Android TV player.

Everything here is the contract the plugin already calls (`src/fontStore.js`,
`src/fonts.js`). Implement the endpoints to these exact shapes and no editor
change is needed.

> Nothing below is provided by this repository — the plugin is the client. The
> database, the endpoints, the object storage and the font processing are yours
> to build.

---

## 1. What the backend must provide

| Piece | Purpose |
|---|---|
| `font_family` + `font_face` tables | the catalogue of uploaded fonts (metadata only) |
| Object storage for the font files | the actual `.woff2` / `.ttf` bytes — **not** in the DB |
| `GET / POST / DELETE /api/fonts` | the editor's font manager talks to these |
| `GET {remoteBase}/{file}` | serves a font file to the editor preview **and** the player |
| a `fonts` column on the screen/content table | which families a screen uses (for the player to prefetch) |

Fonts **bundled** in the player APK are not stored here — the editor adds them
on its own. The database holds only **uploaded** ("remote") fonts.

---

## 2. Database mapping

The HTML content stores a font **by name**, inline: `style="font-family: 'Oswald', sans-serif"`.
So the tables below store the font catalogue and its files; the link "which
screen uses which font" lives on the screen row, not here (see §2.3).

### 2.1 `font_family` — one row per family

```sql
CREATE TABLE font_family (
  id           BIGINT PRIMARY KEY,               -- returned to the editor as row.id
  tenant_id    BIGINT NULL,                      -- NULL = global; a value = one client
  family       VARCHAR(80)  NOT NULL,            -- the @font-face name; stored inline in HTML
  label        VARCHAR(80)  NULL,                -- text shown in the editor's Font dropdown
  fallback     VARCHAR(20)  NOT NULL DEFAULT 'sans-serif', -- sans-serif|serif|cursive|monospace
  source       VARCHAR(16)  NOT NULL DEFAULT 'remote',
  license_note TEXT         NULL,                -- the uploader's right-to-use statement
  status       VARCHAR(16)  NOT NULL DEFAULT 'active',
  created_by   BIGINT       NULL,
  created_at   TIMESTAMP    NOT NULL,
  updated_at   TIMESTAMP    NOT NULL,
  UNIQUE (tenant_id, family)                     -- unique PER TENANT, not globally
);
```

- **`family` is the contract.** It is what `@font-face` declares and what ends up
  inline in saved HTML. Renaming it later orphans every screen already using it,
  so treat it as immutable once content references it.
- `UNIQUE (tenant_id, family)` — two different clients may both have a "Brand
  Sans". Do **not** make `family` globally unique.

### 2.2 `font_face` — one row per weight/style file

```sql
CREATE TABLE font_face (
  id         BIGINT PRIMARY KEY,
  family_id  BIGINT NOT NULL REFERENCES font_family(id) ON DELETE CASCADE,
  file       VARCHAR(255) NOT NULL,   -- storage key; served at remoteBase + file
  weight     SMALLINT NOT NULL DEFAULT 400,   -- 100..900
  style      VARCHAR(10) NOT NULL DEFAULT 'normal', -- normal|italic
  format     VARCHAR(10) NOT NULL,    -- woff2|woff|ttf|otf
  bytes      INT NULL,
  checksum   CHAR(64) NULL,           -- sha256 of the file; lets the player cache incrementally
  created_at TIMESTAMP NOT NULL,
  UNIQUE (family_id, weight, style)
);
```

One family has one row here per weight/style (e.g. Oswald 400 and Oswald 700 are
two `font_face` rows under one `font_family`).

### 2.3 The screen's `fonts` column (existing content table)

No new table — add one column to whatever table holds a screen's HTML:

```sql
ALTER TABLE screen ADD COLUMN fonts TEXT;   -- JSON array of family names, e.g. ["Oswald","Bebas Neue"]
```

The editor computes this list for you and emits it — see §4. The player reads it
to warm its font cache **before** the screen is due, which is what stops the text
from re-flowing mid-rotation.

---

## 3. HTTP API

The editor is wired with:

```js
createFontStore({
  transport: createRestTransport({ endpoint: '/api/fonts' }),
  remoteBase: 'https://cms.smartiv.id/fonts/'   // prefixed onto every face's `file`
});
```

So implement these four routes. All JSON bodies use the shape in §3.1.

### 3.1 The font row shape (used by every response)

```json
{
  "id": 7,
  "family": "Oswald",
  "label": "Oswald",
  "fallback": "sans-serif",
  "source": "remote",
  "faces": [
    { "file": "oswald-400.woff2", "weight": 400, "style": "normal" },
    { "file": "oswald-700.woff2", "weight": 700, "style": "normal" }
  ]
}
```

The editor fills defaults if you omit them: `label` → `family`, `fallback` →
`sans-serif`, each face `weight` → 400, `style` → `normal`. `file` is **relative**
to `remoteBase`.

### 3.2 `GET /api/fonts` — list uploaded fonts

Return an **array** of the row shape above, scoped to the current tenant plus any
global (`tenant_id IS NULL`) families.

```
GET /api/fonts
200 → [ { id, family, label, fallback, source:"remote", faces:[…] }, … ]
```

Do **not** include bundled fonts — the editor adds them itself.

### 3.3 `POST /api/fonts` — upload one face

`multipart/form-data`, one weight/style per request:

| Field | Example | Notes |
|---|---|---|
| `file` | the font file | binary |
| `family` | `Oswald` | the @font-face name |
| `label` | `Oswald` | display name |
| `weight` | `400` | string in the form; store as int |
| `style` | `normal` | `normal` or `italic` |
| `fallback` | `sans-serif` | |

Behaviour: upsert the `font_family` (by `tenant_id` + `family`), store the file,
insert/replace the `font_face` (by `family_id` + `weight` + `style`). Respond with
the **full family row** (§3.1) including all its faces.

```
POST /api/fonts   (multipart)
200 → { id, family, label, fallback, source:"remote", faces:[…] }
```

To add a second weight the editor POSTs again with the same `family` and a
different `weight`; your handler merges it into the same family.

### 3.4 `DELETE /api/fonts/{id}` — remove a family

```
DELETE /api/fonts/7
200 → { } (any JSON; the editor only checks the status)
```

Delete the `font_family` and (cascade) its `font_face` rows. Optionally keep the
files until nothing references the family.

### 3.5 `GET {remoteBase}/{file}` — serve a font file

Serve the stored bytes for a `font_face.file`. Required headers:

```
Content-Type: font/woff2            (or font/woff, font/ttf, font/otf)
Cache-Control: public, max-age=31536000, immutable
Access-Control-Allow-Origin: *      (the player loads from a file:// origin)
```

---

## 4. How the editor produces the `fonts` list

The editor tells the host which families a screen uses, so you can store the
`fonts` column without parsing HTML yourself:

```vue
<SmartivEditor v-model="html" @update:fonts="fonts = $event" />
```

`fonts` is a JSON-serialisable array of family names — persist it on the screen
row. (`editorRef.getUsedFonts()` returns the same on demand.)

---

## 5. Server-side processing on upload (do this, don't skip it)

The editor validates on the client, but the server must re-check and optimise:

1. **Sniff magic bytes**, don't trust the extension: `wOF2` = woff2, `wOFF` =
   woff, `OTTO` = otf, `\x00\x01\x00\x00` / `true` = ttf. Reject anything else.
2. **Size cap** (e.g. 2 MB per face). A multi-megabyte upload is usually a full
   CJK font — subset it.
3. **Convert** `ttf`/`otf` → **woff2** (~40% smaller over the wire).
4. **Subset** to Latin + Latin-Extended (enough for Indonesian) unless the client
   needs more scripts.
5. **Checksum** (sha256) each stored file → `font_face.checksum`, so the player
   can sync only what changed.
6. **Licensing** you cannot verify — record the uploader's statement in
   `license_note` and move on.

Security: font parsers have a CVE history. Serve files from a path/origin that
sends `Content-Type: font/woff2` and `X-Content-Type-Options: nosniff`, and never
serve them as `text/html`.

---

## 6. Feeding the Android TV player

The player (`HtmlView` in the AAR) needs the same files. Per screen it takes:

| Param | From your backend |
|---|---|
| `fontRemoteBase` | the same `remoteBase` URL |
| `fontFiles` | the **face file names** the screen uses, e.g. `["oswald-400.woff2","oswald-700.woff2"]` |
| `remoteFontFaceCss` | an `@font-face` block for those families |

`fontFiles` and `remoteFontFaceCss` are derived from the screen's `fonts`
(family names) by joining to `font_face`:

```sql
SELECT ff.family, fc.file, fc.weight, fc.style
FROM font_family ff
JOIN font_face  fc ON fc.family_id = ff.id
WHERE ff.family IN (:screen_fonts) AND (ff.tenant_id = :tenant OR ff.tenant_id IS NULL);
```

- `fontFiles` = the `file` column from that query.
- `remoteFontFaceCss` = one `@font-face { font-family:'<family>'; src:url('<remoteBase><file>') format('woff2'); font-weight:<weight>; font-style:<style>; }` per row. (The editor exports a `fontFaceCss()` helper that produces exactly this if you build the CMS in JS.)

The player caches each file to disk on first use, so a font is downloaded once
per device and served locally forever after. See
[`android/README.md`](android/README.md) §7.

---

## 7. Multi-tenancy

- `tenant_id NULL` = a global/standard uploaded font, offered to everyone.
- `tenant_id = X` = private to client X.
- `GET /api/fonts` returns `tenant_id = current OR tenant_id IS NULL`.
- `UNIQUE (tenant_id, family)` lets two clients each own a "Brand Sans" without
  collision; the player keys its cache by full URL, so their files never clash
  either.

---

## 8. Migrating fonts you already uploaded

If fonts were already uploaded somewhere else, migrate each into one
`font_family` row plus one `font_face` per weight/style, and copy the files into
object storage under the `file` key. Once `GET /api/fonts` returns them, they
appear in every editor's dropdown automatically.

---

© 2026 Smartiv. See [LICENSE](LICENSE).
