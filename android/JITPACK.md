# Android library via JitPack

The Compose TV player ships as an **AAR** from module `:htmleditor`.

| | |
|---|---|
| Package | `com.smartiv.htmleditor` |
| JitPack page | https://jitpack.io/#SMARTIV-SAAS/HTML-Editor-by-Smartiv |
| Latest published example | `1.0.1` |
| Dependency | `com.github.SMARTIV-SAAS:HTML-Editor-by-Smartiv:<tag>` |

Inside the AAR: `HtmlView`, `FontCache`, `ScreenTheme`, bundled fonts (`assets/fonts/`), and CSS (`assets/smartiv/tv.css`, `assets/smartiv/fonts.css`).

---

## Push ≠ library update

**Pushing ke `main` saja tidak mengganti library di aplikasi.**

JitPack membangun artifact **per Git tag** (atau commit hash), bukan dari branch terbaru.

| Aksi | Efek di app yang sudah depend ke `1.0.1` |
|------|------------------------------------------|
| `git push origin main` | Tidak ada — app tetap pakai AAR tag lama |
| Tag baru `1.0.2` + push tag + build JitPack hijau | Masih tidak, sampai app **menaikkan** versi dependency |
| App ubah ke `implementation("…:1.0.2")` + sync Gradle | Baru dapat kode/AAR baru |

Jadi alurnya selalu: **ubah kode → commit/push → tag versi baru → JitPack build → bump versi di Mobile-TV**.

Jangan reuse tag yang sudah di-build (mis. force-move `1.0.1`). Buat `1.0.2`, `1.0.3`, … supaya cache JitPack/Gradle tidak membingungkan.

---

## Publish versi baru

### 1. Sync CSS ke assets module (jika font/CSS berubah)

```bash
npm run build:android-assets
```

Ini menjalankan `npm run build` lalu menyalin:

- `dist/smartiv-tv.css` → `android/htmleditor/src/main/assets/smartiv/tv.css`
- `dist/smartiv-fonts.css` → `android/htmleditor/src/main/assets/smartiv/fonts.css`

Font `.ttf` di `android/htmleditor/src/main/assets/fonts/` di-commit manual jika ada file baru.

### 2. Commit & push ke GitHub

```bash
git add -A
git commit -m "feat(htmleditor): …"
git push origin main
```

### 3. Buat & push Git tag (semver)

```bash
git tag 1.0.2
git push origin 1.0.2
```

### 4. Build di JitPack

1. Buka https://jitpack.io/#SMARTIV-SAAS/HTML-Editor-by-Smartiv  
2. Look up → pilih tag baru (`1.0.2`)  
3. Tunggu status **hijau** (`ok`)

Atau trigger dengan membuka:

`https://jitpack.io/com/github/SMARTIV-SAAS/HTML-Editor-by-Smartiv/1.0.2/build.log`

Artifact yang dihasilkan:

```
com.github.SMARTIV-SAAS:HTML-Editor-by-Smartiv:1.0.2
```

(`jitpack.yml` menjalankan `./gradlew :htmleditor:publishToMavenLocal`; JitPack mem-publish ulang sebagai artifact repo di atas.)

### 5. Bump versi di app (Mobile-TV)

`gradle/libs.versions.toml`:

```toml
smartivHtmleditor = "1.0.2"
```

`core/components/build.gradle.kts` (atau module konsumen):

```kotlin
implementation("com.github.SMARTIV-SAAS:HTML-Editor-by-Smartiv:${libs.versions.smartivHtmleditor.get()}")
```

Sync Gradle / rebuild app.

---

## Pakai di Mobile-TV (atau app lain)

`settings.gradle.kts`:

```kotlin
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        maven(url = "https://jitpack.io")
    }
}
```

`build.gradle.kts`:

```kotlin
implementation("com.github.SMARTIV-SAAS:HTML-Editor-by-Smartiv:1.0.1")
```

Import:

```kotlin
import com.smartiv.htmleditor.HtmlView
import com.smartiv.htmleditor.ScreenTheme
```

Assets CSS/font sudah di dalam AAR — **tidak perlu** `cp dist/…` ke `app/src/main/assets` untuk path Smartiv player.

---

## Struktur module

```
HTML-Editor-by-Smartiv/
  settings.gradle.kts          # include :htmleditor
  build.gradle.kts
  jitpack.yml                  # JDK 17 + publishToMavenLocal
  gradlew / gradle/wrapper/
  android/htmleditor/          # Android library module
    build.gradle.kts
    src/main/
      java/com/smartiv/htmleditor/
        HtmlView.kt
        FontCache.kt
      assets/
        smartiv/tv.css
        smartiv/fonts.css
        fonts/*.ttf
```

---

## Tes lokal sebelum tag (opsional)

```bash
./gradlew :htmleditor:publishToMavenLocal
```

Di app, sementara tambahkan `mavenLocal()` **sebelum** `jitpack.io`, lalu:

```kotlin
// group/artifact dari maven-publish module (bukan nama repo JitPack)
implementation("com.github.SMARTIV-SAAS:htmleditor:1.0.0")
```

Versi lokal mengikuti `VERSION_NAME` / default di `android/htmleditor/build.gradle.kts`. Setelah puas, tag + JitPack seperti di atas, lalu kembalikan dependency ke koordinat JitPack `HTML-Editor-by-Smartiv:<tag>`.

---

## Troubleshooting

| Gejala | Penyebab umum |
|--------|----------------|
| JitPack: *No build file found* | Tag menunjuk commit lama sebelum Gradle root ada — buat tag baru setelah push setup |
| Log merah / *Report* | Buka `build.log` di JitPack; perbaiki, commit, **tag baru** |
| App masih kode lama | Belum bump versi dependency, atau Gradle cache — naikkan tag + sync |
| Field list tanpa colon / unstyled | CSS belum di-sync ke assets sebelum tag — jalankan `npm run build:android-assets` lalu tag ulang |

Lihat juga panduan render/content: [`README.md`](README.md) di folder ini (copy-file legacy). Untuk konsumsi library, utamakan dokumen ini.
