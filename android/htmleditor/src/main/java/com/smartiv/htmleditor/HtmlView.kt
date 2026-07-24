package com.smartiv.htmleditor

import android.content.Context
import android.graphics.Color
import android.util.Log
import android.view.View
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.graphics.toArgb
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature
import androidx.compose.ui.graphics.Color as ComposeColor

/*
 * Renders content authored in the Smartiv HTML Editor, and still renders the
 * older legacy-authored content unchanged.
 *
 * What was wrong before: the composable wrapped the stored fragment in its own
 * document with only the legacy stylesheet. The editor's field-list layout and
 * its colons live in tv.css — without it the labels stack, the values indent,
 * and every colon vanishes, because the colon is `dt::after` generated content.
 *
 * Setup — two generated files to copy:
 *   npm run build   (in the editor project)
 *   cp dist/smartiv-tv.css     app/src/main/assets/smartiv/tv.css
 *   cp dist/smartiv-fonts.css  app/src/main/assets/smartiv/fonts.css
 *
 * fonts.css carries every @font-face and every .ql-font-* class, generated from
 * src/fonts.js. The .ttf files stay where they are, in assets/fonts/. Adding a
 * font later is one row in that registry plus a rebuild — no Kotlin change.
 *
 * Dependency:
 *   implementation("androidx.webkit:webkit:1.16.0")
 */

private const val TAG = "HtmlView"
private const val TV_CSS_ASSET = "smartiv/tv.css"
private const val FONTS_CSS_ASSET = "smartiv/fonts.css"

/** Background presets — must stay in step with THEMES in the editor. */
enum class ScreenTheme(
    val key: String,
    val background: String,
    val color: String,
    val rule: String,
    val ruleSoft: String,
    /** Solid colour for the WebView itself, so there is no white flash on load. */
    val flatBackground: Int
) {
    LIGHT("light", "#ffffff", "#14181d", "rgba(0,0,0,.18)", "rgba(0,0,0,.05)", 0xFFFFFFFF.toInt()),
    PAPER("paper", "#f4f1ea", "#1a1815", "rgba(0,0,0,.16)", "rgba(0,0,0,.05)", 0xFFF4F1EA.toInt()),
    DARK("dark", "#0f1216", "#f2f5f8", "rgba(255,255,255,.22)", "rgba(255,255,255,.08)", 0xFF0F1216.toInt()),
    MIDNIGHT("midnight", "#0b1a2b", "#eaf2fb", "rgba(255,255,255,.22)", "rgba(255,255,255,.08)", 0xFF0B1A2B.toInt()),
    BRAND(
        "brand",
        "linear-gradient(120deg, #0b63c5 0%, #17a2d8 50%, #2ec5cf 100%)",
        "#ffffff",
        "rgba(255,255,255,.25)",
        "rgba(255,255,255,.1)",
        0xFF17A2D8.toInt()
    );

    companion object {
        fun of(key: String?): ScreenTheme = values().firstOrNull { it.key == key } ?: LIGHT
    }
}

@Composable
fun HtmlView(
    htmlContent: String,
    modifier: Modifier = Modifier,
    /** Theme name stored next to the HTML (the editor's `v-model:theme`). */
    theme: String? = null,
    /**
     * Root font size. Every size in the editor's CSS is in rem against this, so
     * one value rescales the whole screen: 16sp on 1080p, ~13sp on 720p.
     * Body text lands at 1.5rem = 24px, matching the previous default.
     */
    rootFontSize: TextUnit = 16.sp,
    /**
     * Overrides the theme's text colour. Leave null — the theme decides, and any
     * colour the operator picked per word is inline in the HTML and wins anyway.
     */
    fontColor: ComposeColor? = null,
    /**
     * Overscan padding. Keep "0%" when the Compose layout already insets for
     * overscan; set "5%" when this view is full-bleed, or TVs will crop the edges.
     */
    safeArea: String = "0%",
    /** Lay out at a fixed design width so the device matches the editor preview. */
    designWidthPx: Int = 1920,
    isAutoScroll: Boolean = false,
    isCentered: Boolean = false,
    transparentBackground: Boolean = false,
    /**
     * Base URL where the CMS serves self-hosted .woff2 files, e.g.
     * "https://cms.smartiv.id/fonts/". Null keeps the player on bundled fonts
     * only — no network, no cache, the safest mode.
     */
    fontRemoteBase: String? = null,
    /**
     * Font files this screen needs, from the screen's stored `fonts` column.
     * Prefetching these while the previous screen is still up is what stops the
     * text from swapping face mid-rotation.
     */
    fontFiles: List<String> = emptyList(),
    /**
     * @font-face rules for the remote families this screen uses, generated by
     * the CMS with `fontFaceCss({ remoteBase }, usedFonts(html))` and stored on
     * the row. Shipping it with the screen keeps the player from having to
     * fetch a font catalogue before it can render anything.
     */
    remoteFontFaceCss: String = ""
) {
    val lifecycleOwner = LocalLifecycleOwner.current
    val context = LocalContext.current

    // Reading the stylesheet once per composition beats re-opening the asset on
    // every recomposition, which the old update block effectively did.
    val tvCss = remember { readAsset(context, TV_CSS_ASSET) }
    val fontsCss = remember { readAsset(context, FONTS_CSS_ASSET) }
    val screenTheme = remember(theme) { ScreenTheme.of(theme) }

    val fontCache = remember(fontRemoteBase) {
        fontRemoteBase?.let { FontCache(context.applicationContext, it) }
    }

    // Download ahead of the paint, off the UI thread. A miss here is not fatal:
    // the interceptor will try again, and the fallback face still renders.
    LaunchedEffect(fontCache, fontFiles) {
        if (fontCache != null && fontFiles.isNotEmpty()) {
            withContext(Dispatchers.IO) { fontCache.prefetch(fontFiles) }
        }
    }

    val document = remember(htmlContent, screenTheme, rootFontSize, fontColor, safeArea, designWidthPx, isAutoScroll, isCentered, tvCss, fontsCss, remoteFontFaceCss) {
        buildDocument(
            htmlContent = htmlContent,
            tvCss = tvCss,
            fontsCss = fontsCss + "\n" + remoteFontFaceCss,
            theme = screenTheme,
            rootFontSize = rootFontSize,
            fontColor = fontColor,
            safeArea = safeArea,
            designWidthPx = designWidthPx,
            enableAutoScroll = isAutoScroll,
            isCentered = isCentered
        )
    }

    val webViewHolder = remember { arrayOfNulls<WebView>(1) }
    // View.setTag(int, …) rejects any key that is not a resource id, so the last
    // rendered payload is tracked here instead.
    val lastPayload = remember { arrayOfNulls<String>(1) }

    AndroidView(
        modifier = modifier,
        factory = { ctx ->
            WebView(ctx).apply {
                webViewHolder[0] = this
                setBackgroundColor(if (transparentBackground) Color.TRANSPARENT else screenTheme.flatBackground)
                isVerticalScrollBarEnabled = false
                isHorizontalScrollBarEnabled = false
                overScrollMode = View.OVER_SCROLL_NEVER

                settings.apply {
                    // Only the auto-scroll helper needs a script engine.
                    javaScriptEnabled = isAutoScroll
                    allowFileAccess = true          // @font-face reads file:///android_asset
                    useWideViewPort = true          // honour <meta viewport width=1920>
                    loadWithOverviewMode = true     // scale that width down to the panel
                    textZoom = 100                  // TV font scaling must not touch the rem scale
                    cacheMode = WebSettings.LOAD_NO_CACHE
                }

                // The document states its own colours; letting WebView invert them
                // would turn the light theme dark behind the operator's back.
                if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
                    WebSettingsCompat.setAlgorithmicDarkeningAllowed(settings, false)
                } else if (WebViewFeature.isFeatureSupported(WebViewFeature.FORCE_DARK)) {
                    @Suppress("DEPRECATION")
                    WebSettingsCompat.setForceDark(settings, WebSettingsCompat.FORCE_DARK_OFF)
                }

                webViewClient = object : WebViewClient() {
                    override fun shouldInterceptRequest(
                        view: WebView,
                        request: WebResourceRequest
                    ): WebResourceResponse? = fontCache?.intercept(request.url)

                    override fun onPageFinished(view: WebView?, url: String?) {
                        super.onPageFinished(view, url)
                        // Scripts only exist once the page is parsed; the old code
                        // also fired this straight after load(), where it was a no-op.
                        if (isAutoScroll) view?.evaluateJavascript("startAutoScroll();", null)
                    }

                    @Deprecated("Kept for API < 23 devices still in the fleet")
                    override fun onReceivedError(
                        view: WebView?,
                        errorCode: Int,
                        description: String?,
                        failingUrl: String?
                    ) {
                        Log.e(TAG, "Load error: $description ($errorCode) for $failingUrl")
                    }
                }

                lastPayload[0] = document
                loadDataWithBaseURL("file:///android_asset/", document, "text/html", "UTF-8", null)
            }
        },
        update = { webView ->
            // Reload only when the payload actually changed. The previous version
            // reloaded on every recomposition, which flashed the screen.
            if (lastPayload[0] != document) {
                lastPayload[0] = document
                webView.settings.javaScriptEnabled = isAutoScroll
                webView.setBackgroundColor(
                    if (transparentBackground) Color.TRANSPARENT else screenTheme.flatBackground
                )
                webView.loadDataWithBaseURL("file:///android_asset/", document, "text/html", "UTF-8", null)
            } else if (!isAutoScroll) {
                webView.evaluateJavascript("stopAutoScroll();", null)
            }
        },
        onRelease = { webView ->
            webView.stopLoading()
            webView.destroy()
            webViewHolder[0] = null
            lastPayload[0] = null
        }
    )

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_STOP || event == Lifecycle.Event.ON_DESTROY) {
                webViewHolder[0]?.evaluateJavascript("stopAutoScroll();", null)
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }
}

private fun readAsset(context: Context, path: String): String =
    runCatching { context.assets.open(path).bufferedReader().use { it.readText() } }
        .onFailure { Log.e(TAG, "Missing asset $path — field lists will render unstyled", it) }
        .getOrDefault("")

/**
 * Which authoring tool produced this HTML.
 *
 * The editor stamps `<div class="sv-doc" data-sv-doc="1">` around everything it
 * saves, so the answer is stated rather than guessed. The class check is the
 * fallback for content saved before the marker existed — drop it once no
 * unmarked Smartiv content is left in the database.
 */
private fun isSmartivContent(html: String): Boolean =
    html.contains("data-sv-doc") ||
        html.contains("sv-fields") || html.contains("sv-panels") || html.contains("sv-panel")

/** Format version, or 0 for legacy-authored content. Useful for future migrations. */
private val DOC_VERSION = Regex("""data-sv-doc="(\d+)"""")

private fun documentVersion(html: String): Int =
    DOC_VERSION.find(html)?.groupValues?.get(1)?.toIntOrNull()
        ?: if (isSmartivContent(html)) 1 else 0

private fun buildDocument(
    htmlContent: String,
    tvCss: String,
    fontsCss: String,
    theme: ScreenTheme,
    rootFontSize: TextUnit,
    fontColor: ComposeColor?,
    safeArea: String,
    designWidthPx: Int,
    enableAutoScroll: Boolean,
    isCentered: Boolean
): String {
    val smartiv = isSmartivContent(htmlContent)
    val textColor = fontColor?.let { String.format("#%06X", 0xFFFFFF and it.toArgb()) } ?: theme.color

    val bodyClass = if (smartiv) "sv-tv" else "legacy"
    val body = if (smartiv) {
        """<main class="sv-tv__safe">$htmlContent</main>"""
    } else {
        htmlContent
    }

    val centerCss = if (isCentered) """
        .sv-tv__safe, body.legacy {
            text-align: center;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
    """.trimIndent() else ""

    return """
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=$designWidthPx, initial-scale=1">
<style>
:root {
  --sv-bg: ${theme.background};
  --sv-color: $textColor;
  --sv-rule: ${theme.rule};
  --sv-rule-soft: ${theme.ruleSoft};
  --sv-font: Roboto, "Noto Sans", system-ui, sans-serif;
  --sv-safe-area: $safeArea;
  font-size: ${rootFontSize.value}px;
}
$fontsCss
${legacyCss(textColor, rootFontSize)}
$tvCss
$centerCss
</style>
${autoScrollScript(enableAutoScroll)}
</head>
<body class="$bodyClass">
$body
</body>
</html>
    """.trimIndent()
}

/**
 * Legacy-era rules, kept so existing content renders exactly as before.
 *
 * @font-face and the .ql-font-* map now live in the generated fonts.css, which
 * is inlined ahead of this block — one registry feeds both the editor's font
 * dropdown and the player, so the two can no longer drift apart.
 *
 * The body block is scoped to `body.legacy` on purpose: applied to `body`
 * unconditionally it would fight the theme on Smartiv content. Everything the
 * editor emits out-specifies these anyway, but explicit beats lucky.
 */
private fun legacyCss(textColor: String, rootFontSize: TextUnit): String = """
.ql-align-center  { text-align: center; }
.ql-align-right   { text-align: right; }
.ql-align-justify { text-align: justify; }

body { margin: 0; padding: 0; }

body.legacy {
  color: $textColor;
  font-size: ${rootFontSize.value * 1.5}px;
  overflow-y: auto;
  line-height: 1.1;
}
body.legacy h1, body.legacy h2, body.legacy h3,
body.legacy h4, body.legacy h5, body.legacy h6,
body.legacy p {
  line-height: 1.1;
  margin-top: 0.1em;
  margin-bottom: 0.1em;
}
"""

private fun autoScrollScript(enabled: Boolean): String = if (!enabled) "" else """
<script>
let scrollIntervalId = null;
let currentScrollPos = 0;
const scrollStep = 20;
const scrollDelay = 5000;

function startAutoScroll() {
  stopAutoScroll();
  setTimeout(() => {
    scrollIntervalId = setInterval(() => {
      const maxScroll = document.body.scrollHeight - window.innerHeight;
      if (maxScroll <= 0) { stopAutoScroll(); return; }
      if (currentScrollPos >= maxScroll) {
        currentScrollPos = 0;
        window.scrollTo(0, 0);
        stopAutoScroll();
        setTimeout(startAutoScroll, scrollDelay);
        return;
      }
      currentScrollPos = Math.min(currentScrollPos + scrollStep, maxScroll);
      window.scrollTo(0, currentScrollPos);
    }, scrollDelay);
  }, scrollDelay);
}

function stopAutoScroll() {
  if (scrollIntervalId !== null) {
    clearInterval(scrollIntervalId);
    scrollIntervalId = null;
  }
}
</script>
"""
