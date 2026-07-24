<script setup>
import { computed } from 'vue';
import ToolbarItem from './ToolbarItem.vue';

const props = defineProps({
  editor: { type: Object, required: true },
  /** Array of groups; each group is an array of registered button names. */
  layout: { type: Array, required: true },
  tick: { type: Number, default: 0 }
});

/** Resolve names to registry entries, dropping anything whose plugin is absent. */
const groups = computed(() =>
  props.layout
    .map((group) => group.map((name) => props.editor.ui.buttons.get(name)).filter(Boolean))
    .filter((group) => group.length)
);
</script>

<template>
  <div class="sv-toolbar" role="toolbar">
    <div v-for="(group, gi) in groups" :key="gi" class="sv-toolbar__group">
      <ToolbarItem
        v-for="item in group"
        :key="item.name"
        :item="item"
        :editor="editor"
        :tick="tick"
      />
    </div>
  </div>
</template>
