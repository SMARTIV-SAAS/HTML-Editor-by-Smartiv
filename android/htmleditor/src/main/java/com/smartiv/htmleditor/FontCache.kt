package com.smartiv.htmleditor

import android.content.Context
import android.net.Uri
import android.util.Log
import android.webkit.WebResourceResponse
import java.io.File
import java.io.FileInputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/**
 * Disk cache for CMS-hosted fonts.
 *
 * A remote font costs one download on the first play. After that it is served
 * from filesDir and behaves exactly like a bundled asset — no network, no
 * re-flow when a screen rotates back around.
 *
 * The CMS mirrors the .woff2 files itself (Google Fonts are OFL/Apache, so
 * self-hosting is permitted), which means the player never resolves
 * fonts.googleapis.com: one host under our control, working on networks that
 * block Google, and a file that cannot change under us when Google updates a
 * family.
 *
 * Call [prefetch] with the screen's stored `fonts` list while the *previous*
 * screen is still showing. By the time the new screen paints, the faces are
 * already local and the text never swaps.
 */
class FontCache(
    context: Context,
    /** Where the CMS serves font files, e.g. "https://cms.smartiv.id/fonts/". */
    private val remoteBase: String,
    private val maxBytes: Long = 20L * 1024 * 1024
) {
    private val dir = File(context.filesDir, "webfonts").apply { mkdirs() }
    private val base = if (remoteBase.endsWith("/")) remoteBase else "$remoteBase/"

    /**
     * Serve a font request from disk, downloading it on a miss.
     *
     * Runs on a WebView worker thread, never the UI thread, so blocking IO here
     * is correct. Returning null hands the request back to WebView.
     */
    fun intercept(url: Uri): WebResourceResponse? {
        val full = url.toString()
        if (!full.startsWith(base)) return null
        if (!full.isFontUrl()) return null

        val file = cacheFileFor(full)
        if (!file.exists() && !download(full, file)) return null

        return runCatching {
            WebResourceResponse(
                mimeOf(full),
                null,
                200,
                "OK",
                // The document is loaded from a file:// base, so its origin is
                // opaque and the font fetch is cross-origin. Without this header
                // WebView discards the response and falls back silently.
                mapOf("Access-Control-Allow-Origin" to "*", "Cache-Control" to "max-age=31536000"),
                FileInputStream(file)
            )
        }.getOrNull()
    }

    /** Warm the cache for the families a screen declares. Safe to call off the UI thread. */
    fun prefetch(fileNames: List<String>) {
        for (name in fileNames) {
            val full = base + name
            val file = cacheFileFor(full)
            if (!file.exists()) download(full, file)
        }
        trim()
    }

    fun clear() {
        dir.listFiles()?.forEach { it.delete() }
    }

    private fun download(url: String, target: File): Boolean = runCatching {
        val connection = (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 8_000
            readTimeout = 15_000
            instanceFollowRedirects = true
        }
        try {
            if (connection.responseCode !in 200..299) {
                Log.w(TAG, "Font ${connection.responseCode} for $url")
                return false
            }
            // Write to a temp name first: a half-downloaded file left at the real
            // path would be cached forever as a corrupt font.
            val temp = File(target.parentFile, "${target.name}.part")
            connection.inputStream.use { input -> temp.outputStream().use { input.copyTo(it) } }
            temp.renameTo(target)
        } finally {
            connection.disconnect()
        }
        true
    }.getOrElse {
        Log.w(TAG, "Font download failed for $url", it)
        false
    }

    /** Drop the least recently used files once the cache outgrows its budget. */
    private fun trim() {
        val files = dir.listFiles()?.sortedBy { it.lastModified() } ?: return
        var total = files.sumOf { it.length() }
        for (file in files) {
            if (total <= maxBytes) break
            total -= file.length()
            file.delete()
        }
    }

    private fun cacheFileFor(url: String): File {
        val digest = MessageDigest.getInstance("SHA-256").digest(url.toByteArray())
        val name = digest.joinToString("") { "%02x".format(it) }.take(32)
        return File(dir, "$name.${url.substringAfterLast('.', "bin").substringBefore('?')}")
    }

    private fun String.isFontUrl(): Boolean {
        val path = substringBefore('?')
        return path.endsWith(".woff2") || path.endsWith(".woff") ||
            path.endsWith(".ttf") || path.endsWith(".otf")
    }

    private fun mimeOf(url: String): String = when {
        url.contains(".woff2") -> "font/woff2"
        url.contains(".woff") -> "font/woff"
        url.contains(".otf") -> "font/otf"
        else -> "font/ttf"
    }

    private companion object {
        const val TAG = "FontCache"
    }
}
