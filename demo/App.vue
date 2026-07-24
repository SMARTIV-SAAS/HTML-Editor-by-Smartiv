<script setup>
import { ref, computed } from 'vue';
import '../src/styles/editor.css';

// Two editors on two "pages", the way a CMS embeds them. Uploading a font on
// the Fonts tab has to reach both without either being remounted.
const tab = ref('screens');

const roomScreen = ref(`
<div class="sv-panels" data-sv-block="panels" data-sv-columns="1">
  <div class="sv-panel">
    <h1 class="sv-panel__title">MEETING IN PROGRESS</h1>
    <dl class="sv-fields" data-sv-colon="align">
      <dt>Event</dt><dd>Coordination &amp; Technical Briefing</dd>
      <dt>Host</dt><dd>Media Team</dd>
      <dt>Time</dt><dd>14.00 – 16.00</dd>
      <dt>Status</dt><dd><span style="color: #e63946">Occupied</span></dd>
    </dl>
    <p><em>Please keep quiet — a recording session is in progress.</em></p>
  </div>
</div>
`.trim());

const welcomeScreen = ref(`
<h1>WELCOME</h1>
<dl class="sv-fields" data-sv-colon="align">
  <dt>Guest</dt><dd>PT Nusantara Media</dd>
  <dt>Room</dt><dd>Studio 3A</dd>
</dl>
`.trim());

const tv = { title: 'Smartiv Room Display', rootFontSize: '16px' };
const roomTheme = ref('light');
const welcomeTheme = ref('brand');

const roomFonts = ref([]);
const welcomeFonts = ref([]);
</script>

<template>
  <h1 style="font-size:20px;margin:0 0 4px">Smartiv HTML Editor</h1>
  <p style="margin:0 0 14px;color:#5b6773;font-size:14px">
    Two editors below share one font
    catalogue: upload on the <strong>Fonts</strong> tab and both dropdowns pick it
    up immediately.
  </p>

  <nav style="display:flex;gap:8px;margin-bottom:16px">
    <button
      v-for="t in ['screens', 'fonts']"
      :key="t"
      :style="{
        padding: '7px 16px', borderRadius: '6px', cursor: 'pointer', font: 'inherit',
        border: '1px solid ' + (tab === t ? '#0b63c5' : '#d8dee7'),
        background: tab === t ? '#0b63c5' : 'transparent',
        color: tab === t ? '#fff' : 'inherit'
      }"
      @click="tab = t"
    >{{ t === 'screens' ? 'Screens' : 'Fonts' }}</button>
  </nav>

  <!-- Kept mounted: switching tabs must not reset either editor. -->
  <div v-show="tab === 'screens'" style="display:grid;gap:24px">
    <section>
      <h2 style="font-size:14px;margin:0 0 8px;color:#5b6773">Room display</h2>
      <SmartivEditor
        v-model="roomScreen"
        v-model:theme="roomTheme"
        :options="{ tv, autoDownload: false }"
        min-height="360px"
        @update:fonts="roomFonts = $event"
      />
      <p style="margin:6px 0 0;font-size:12px;color:#5b6773">
        Fonts used: <code>{{ roomFonts.length ? roomFonts.join(', ') : 'none' }}</code>
      </p>
    </section>

    <section>
      <h2 style="font-size:14px;margin:0 0 8px;color:#5b6773">Welcome screen</h2>
      <SmartivEditor
        v-model="welcomeScreen"
        v-model:theme="welcomeTheme"
        :options="{ tv, autoDownload: false }"
        min-height="260px"
        @update:fonts="welcomeFonts = $event"
      />
      <p style="margin:6px 0 0;font-size:12px;color:#5b6773">
        Fonts used: <code>{{ welcomeFonts.length ? welcomeFonts.join(', ') : 'none' }}</code>
      </p>
    </section>
  </div>

  <div v-show="tab === 'fonts'">
    <SmartivFontManager />
  </div>
</template>
