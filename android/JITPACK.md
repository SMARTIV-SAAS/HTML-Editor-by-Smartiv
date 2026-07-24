# Android library (JitPack)

Module `:htmleditor` packages the Compose `HtmlView`, `FontCache`, bundled fonts, and generated CSS into an AAR.

## Publish a new version

1. **Sync assets** after CSS/font registry changes:
   ```bash
   npm run build:android-assets
   ```
2. **Commit and push** to `https://github.com/SMARTIV-SAAS/HTML-Editor-by-Smartiv`
3. **Create a Git tag** (semver), e.g. `1.0.0`:
   ```bash
   git tag 1.0.0
   git push origin 1.0.0
   ```
4. **Build on JitPack** (first time for a tag):
   - Open `https://jitpack.io/#SMARTIV-SAAS/HTML-Editor-by-Smartiv`
   - Click **Look up** on the tag (e.g. `1.0.0`)
   - Wait until status is **green** (Get it)

## Use in Mobile-TV (or any app)

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
implementation("com.github.SMARTIV-SAAS:htmleditor:1.0.0")
```

If JitPack lists the submodule explicitly, use:

```kotlin
implementation("com.github.SMARTIV-SAAS:HTML-Editor-by-Smartiv:htmleditor:1.0.0")
```

Import:

```kotlin
import com.smartiv.htmleditor.HtmlView
import com.smartiv.htmleditor.ScreenTheme
```

Assets (`smartiv/*.css`, `fonts/*.ttf`) ship inside the AAR and merge into the app APK automatically.

## Local test before JitPack

```bash
./gradlew :htmleditor:publishToMavenLocal
```

In the app, add `mavenLocal()` to repositories and depend on `com.github.SMARTIV-SAAS:htmleditor:1.0.0`.
