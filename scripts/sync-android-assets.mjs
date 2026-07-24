import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'android/htmleditor/src/main/assets/smartiv');

mkdirSync(assets, { recursive: true });
copyFileSync(join(root, 'dist/smartiv-tv.css'), join(assets, 'tv.css'));
copyFileSync(join(root, 'dist/smartiv-fonts.css'), join(assets, 'fonts.css'));

console.log('Synced tv.css and fonts.css → android/htmleditor/src/main/assets/smartiv/');
