# Android TV viewer

> **Preferred install:** consume the AAR from JitPack — see **[JITPACK.md](JITPACK.md)**.  
> Pushing `main` alone does **not** update apps; publish a **new Git tag**, wait for a green JitPack build, then bump the dependency version in the player app.

The source for the player lives in the Gradle module:

| Path | Role |
|---|---|
| `htmleditor/…/HtmlView.kt` | Jetpack Compose `@Composable` WebView document builder |
| `htmleditor/…/FontCache.kt` | Disk cache + `shouldInterceptRequest` for remote fonts |
| `htmleditor/src/main/assets/smartiv/` | Generated `tv.css` + `fonts.css` (via `npm run build:android-assets`) |
| `htmleditor/src/main/assets/fonts/` | Bundled `.ttf` files |

```kotlin
implementation("com.github.SMARTIV-SAAS:HTML-Editor-by-Smartiv:1.0.4")
```

```kotlin
import com.smartiv.htmleditor.HtmlView
import com.smartiv.htmleditor.ScreenTheme
```

The sections below remain useful for understanding assets, themes, and coexistence with legacy Quill HTML. Skip the “copy Kotlin into your app” path if you use JitPack.

---

## 1. Prerequisites (when not using the AAR)

```kotlin
// build.gradle.kts (app module) — only if you vendor sources instead of JitPack
dependencies {
    implementation("androidx.webkit:webkit:1.16.0")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.runtime:runtime")
    implementation(platform("androidx.compose:compose-bom:2024.09.00"))
}
```

- **minSdk 23+** for the published library module (WebView is System WebView / Chromium).
- A device **without** a WebView provider (some very cheap TV boxes) throws on
  `WebView(context)`. Guard with `WebViewCompat.getCurrentWebViewPackage(context)`
  if you target such hardware.

Library package: `com.smartiv.htmleditor`.

---

## 2. Stylesheets & fonts

With JitPack, CSS and fonts are **inside the AAR**. After changing `src/fonts.js` or TV CSS in the editor repo:

```bash
npm run build:android-assets
# commit android/htmleditor/src/main/assets/… then tag a new version
```

Manual copy into an app (legacy / non-JitPack) still works:

```bash
npm install
npm run build
cp dist/smartiv-tv.css     app/src/main/assets/smartiv/tv.css
cp dist/smartiv-fonts.css  app/src/main/assets/smartiv/fonts.css
```

```
app/src/main/assets/
  smartiv/
    tv.css
    fonts.css
  fonts/
    RobotoFlex.ttf
    Montserrat-VariableFont_wght.ttf
    …the 12 bundled .ttf files…
```

`fonts.css` references `file:///android_asset/fonts/<file>.ttf`, so the folder
names above must match. If either CSS asset is missing, field lists render
unstyled (labels stack, colons vanish) — the log line from `readAsset` tells you
which file was not found.

---

## 3. Manifest

Nothing is required for **bundled** fonts and local content. Add `INTERNET` only
if you use self-hosted remote fonts (section 7):

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

If your CMS serves fonts over plain HTTP, also allow cleartext for that host via
a `network-security-config`. HTTPS needs nothing.

---

## 4. What the viewer expects from your database

No schema change is forced. `HtmlView` reads three things off a screen row; only
the first is required:

| Column | Type | Example | Notes |
|---|---|---|---|
| `html` | TEXT | `<div class="sv-doc" data-sv-doc="1">…` | the stored content, as-is |
| `theme` | TEXT | `"light"` | optional; **the editor no longer emits it (removed in 1.0.4)** — see the note below |
| `fonts` | TEXT (JSON) | `["Oswald","Bebas Neue"]` | families used, for remote-font prefetch only |

`fonts` comes from the editor's `@update:fonts` event / `getUsedFonts()`. Store
it and hand it back.

> **Note on `theme` (1.0.4):** the editor no longer has a background theme, so it
> does not produce a `theme` value. `HtmlView` still accepts the `theme`
> parameter for backward compatibility, but on a transparent player it only sets
> the default text colour. Prefer leaving it null and setting text colour inline
> in the editor, or pass `fontColor` for a screen-wide default (e.g.
> `Color.White` over a dark wallpaper).

---

## 5. Minimal usage

```kotlin
@Composable
fun ScreenPlayer(screen: ScreenRow) {
    HtmlView(
        htmlContent = screen.html,
        theme = screen.theme,          // "light" | "paper" | "dark" | "midnight" | "brand"
        modifier = Modifier.fillMaxSize()
    )
}
```

That is the whole integration for bundled fonts. Everything below is optional
tuning.

---

## 6. Full parameter reference

```kotlin
HtmlView(
    htmlContent: String,               // required — the stored HTML
    modifier: Modifier = Modifier,
    theme: String? = null,             // background preset key; null → "light"
    rootFontSize: TextUnit = 16.sp,    // 1080p; ~13.sp for 720p panels
    fontColor: ComposeColor? = null,   // override; leave null so the theme + inline colours decide
    safeArea: String = "0%",           // "5%" when full-bleed; "0%" if Compose already insets
    designWidthPx: Int = 1920,         // authoring width; matches the editor preview
    isAutoScroll: Boolean = false,     // slow vertical crawl for overflowing content
    isCentered: Boolean = false,       // vertical-centre the content block
    transparentBackground: Boolean = true,   // default: WebView is transparent, the player's wallpaper shows through. Set false only for an opaque screen.
    fontRemoteBase: String? = null,    // CMS font base URL; null = bundled only
    fontFiles: List<String> = emptyList(),   // remote font filenames to prefetch
    remoteFontFaceCss: String = ""     // @font-face for remote families, from the CMS
)
```

### Themes

| `theme` | Background | Text |
|---|---|---|
| `light` (default) | `#ffffff` | `#14181d` |
| `paper` | `#f4f1ea` | `#1a1815` |
| `dark` | `#0f1216` | `#f2f5f8` |
| `midnight` | `#0b1a2b` | `#eaf2fb` |
| `brand` | Smartiv blue gradient | `#ffffff` |

These presets live only in the `ScreenTheme` enum in `HtmlView.kt` now (the
editor's theme concept was removed in 1.0.4). With `transparentBackground = true`
the background is not painted at all — only the text colour applies.

### Sizing for 720p vs 1080p

Every size in the content CSS is `rem` against `rootFontSize`. To move a whole
screen between panel resolutions, change only that value:

```kotlin
val root = if (isPanel720p) 13.sp else 16.sp
HtmlView(htmlContent = screen.html, rootFontSize = root, …)
```

Body text is `1.5rem`, so 16.sp → 24px, matching the editor preview.

### Overscan

Consumer TVs crop up to 5% of each edge. If `HtmlView` fills the display edge to
edge, pass `safeArea = "5%"`. If your Compose layout already pads for overscan,
leave it `"0%"` so you do not inset twice.

---

## 7. Fonts

Two tiers, and you can ship with only the first:

**Bundled** — the 12 `.ttf` files in `assets/fonts/`, wired by `fonts.css`.
Always available, no network, nothing else to configure.

**Remote (self-hosted)** — fonts an operator uploaded in the CMS. The CMS mirrors
the file and serves it; the player caches it to disk on first use. **Do not fetch
Google Fonts directly from the player** — mirror through your CMS so there is one
host you control, it works on networks that block Google, and the font version
cannot change under a screen that was already approved.

Wire it up with `FontCache` and three parameters:

```kotlin
val fontCache = remember { FontCache(context.applicationContext, remoteBase = "https://cms.smartiv.id/fonts/") }

HtmlView(
    htmlContent = screen.html,
    theme = screen.theme,
    fontRemoteBase = "https://cms.smartiv.id/fonts/",
    fontFiles = screen.fontFiles,        // e.g. ["oswald-400.woff2","oswald-700.woff2"]
    remoteFontFaceCss = screen.fontFaceCss  // @font-face block generated by the CMS
)
```

`HtmlView` already creates its own `FontCache` from `fontRemoteBase` and installs
the interceptor, so the explicit instance above is only needed if you want to
**prefetch ahead of the paint**:

```kotlin
// while the PREVIOUS screen is still showing
LaunchedEffect(nextScreen) {
    withContext(Dispatchers.IO) { fontCache.prefetch(nextScreen.fontFiles) }
}
```

Prefetching is what stops the text from swapping face mid-rotation. Without it,
the first showing of a not-yet-cached font renders in the fallback and then swaps
when the download lands; after that it is instant forever.

`FontCache` writes atomically (`.part` then rename), serves cached files with an
`Access-Control-Allow-Origin: *` header (required because the document loads from
a `file://` base), and trims itself to 20 MB LRU. Change the budget with the
`maxBytes` constructor argument.

The CMS produces `remoteFontFaceCss` with the editor's
`fontFaceCss({ remoteBase }, usedFonts(html))` helper and `fontFiles` from
`usedFontNames(html)` — see the main README's font-manager section.

---

## 8. Coexisting with legacy content

During the transition the same `html` column holds two formats. The editor
stamps everything it saves:

```html
<div class="sv-doc" data-sv-doc="1"> … </div>
```

`HtmlView` reads that marker (`isSmartivContent` / `documentVersion`) and picks
the stylesheet:

- **Smartiv content** → `body.sv-tv` + `tv.css` + theme.
- **Legacy content** → `body.legacy` + the `.ql-*` rules, rendered exactly
  as the old app did.

The two never collide: the legacy `body` block is scoped to `.legacy`. Content
saved before the marker existed still matches on the `sv-fields` / `sv-panels`
class fallback — drop that fallback from `isSmartivContent` once no unmarked
Smartiv content is left in the database.

### The rollout order that stays seamless

The combination to watch is **new content on an old player**: an old APK has no
`tv.css`, so a Smartiv screen there loses its layout. Because the CMS updates
once but the fleet updates gradually, ship in this order:

1. **Roll out this viewer first.** No content or CMS change. New players read both
   formats; old players keep working on legacy content. This fills the fleet.
2. **Then** switch the CMS editor over and start authoring Smartiv content.
3. Once telemetry shows the fleet is fully updated, remove the legacy CSS and the
   class-name fallback.

You need per-device APK-version telemetry to know when step 3 is safe.

---

## 9. Auto-scroll

For content taller than the screen, `isAutoScroll = true` runs a slow vertical
crawl that loops with a pause at each end. It enables JavaScript in the WebView
(otherwise the viewer runs with JS off). Leave it `false` for static screens —
most room displays fit and should not move.

The crawl is paused automatically on `ON_STOP` / `ON_DESTROY` so it does not run
against a backgrounded view.

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Labels stack, colons gone | `tv.css` not loaded | confirm `assets/smartiv/tv.css` exists; check the `readAsset` log line |
| Custom font shows as a fallback | file not cached yet, or family name mismatch | prefetch before paint; confirm `remoteFontFaceCss` family matches the `font-family` in the HTML |
| Light theme renders dark | WebView algorithmic darkening | already disabled in `HtmlView`; verify `androidx.webkit` is on the classpath |
| White flash on screen change | background painted late | `HtmlView` sets the theme colour up front — make sure `theme` is passed |
| Fonts never load | no `INTERNET` permission, or HTTP blocked | add the permission; allow cleartext for the CMS host if it is HTTP |
| Blank after a while, comes back on reload | renderer process was killed (low-RAM box) | attach `WebViewCompat.setWebViewRenderProcessClient` and reload on `onRenderProcessUnresponsive` |
| Text re-sizes oddly on a wide panel | WebView text autosizing | `HtmlView` sets `textZoom = 100` and `text-size-adjust:100%`; do not override `textZoom` |
| Old legacy screen lost its fonts | `fonts.css` missing the `.ql-font-*` map | recopy `dist/smartiv-fonts.css` — it now includes the legacy class map |
