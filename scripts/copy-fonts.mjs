/**
 * Copy the bundled .ttf files into dist/fonts/ so they ship inside the npm
 * package. The editor needs the font bytes reachable by a URL to (a) preview
 * the faces and (b) embed them as base64 in the standalone export — a CMS can
 * then serve these files and set `fontBundledBase` instead of hunting for them.
 *
 * Source of truth is the same folder the Android AAR bundles, so the editor,
 * the export, and the TV player all ship byte-identical faces.
 */
import { readdir, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const srcDir = join(root, 'android', 'htmleditor', 'src', 'main', 'assets', 'fonts');
const outDir = join(root, 'dist', 'fonts');

await mkdir(outDir, { recursive: true });
const files = (await readdir(srcDir)).filter((f) => /\.(ttf|otf|woff2?|woff)$/i.test(f));

if (files.length === 0) {
  console.error(`copy-fonts: no font files found in ${srcDir}`);
  process.exit(1);
}

for (const f of files) {
  await copyFile(join(srcDir, f), join(outDir, f));
}

console.log(`copied ${files.length} bundled fonts to dist/fonts/`);
