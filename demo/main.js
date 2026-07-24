import { createApp } from 'vue';
import App from './App.vue';
import SmartivEditorPlugin, { createFontStore } from '../src/index.js';

// No transport here: the demo has no backend, so uploads stay session-only.
// In the CMS, pass createRestTransport({ endpoint: '/api/fonts' }).
const fonts = createFontStore({ remoteBase: '/fonts/' });

createApp(App).use(SmartivEditorPlugin, { fonts }).mount('#app');
