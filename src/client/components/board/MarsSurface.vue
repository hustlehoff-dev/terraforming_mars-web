<template>
  <div v-if="enabled" ref="viewport" class="mars-surface">
    <div class="mars-surface__frame" :style="frameStyle">
      <img v-if="!tracks" class="mars-surface__raster" src="assets/board/mars-globe.jpg" alt="">
      <div class="mars-surface__board"><slot></slot></div>
    </div>
  </div>
  <slot v-else></slot>
</template>

<script setup lang="ts">
import {computed, ref, watch} from 'vue';

const FRAME_WIDTH = 1280;
const FRAME_HEIGHT = 720;

const props = defineProps<{enabled: boolean; tracks: boolean}>();
const viewport = ref<HTMLElement>();
const viewportSize = ref({width: FRAME_WIDTH, height: FRAME_HEIGHT});
const scale = computed(() => {
  // The classic tracks use the full board frame. The surface only needs
  // to fit the projected hexes inside the HUD clearances.
  const boardWidth = props.tracks ? 765 : 550;
  const boardHeight = props.tracks ? 680 : 500;
  return Math.min(1.12, Math.max(0, viewportSize.value.width - 24) / boardWidth, viewportSize.value.height / boardHeight);
});
const frameStyle = computed(() => ({
  width: `${FRAME_WIDTH}px`,
  height: `${FRAME_HEIGHT}px`,
  transform: `translate(-50%, -50%) scale(${scale.value})`,
}));

watch(viewport, (element, _previous, cleanup) => {
  if (!element) {
    return;
  }
  const update = () => {
    viewportSize.value = {width: element.clientWidth, height: element.clientHeight};
  };
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(update);
    observer.observe(element);
    cleanup(() => observer.disconnect());
  } else {
    window.addEventListener('resize', update);
    cleanup(() => window.removeEventListener('resize', update));
  }
  update();
}, {flush: 'post'});
</script>
