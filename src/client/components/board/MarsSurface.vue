<template>
  <div v-if="enabled" ref="viewport" class="mars-surface">
    <div class="mars-surface__frame" :style="frameStyle">
      <div v-if="!tracks" class="mars-surface__raster" :style="globeStyle" aria-hidden="true"></div>
      <div class="mars-surface__board"><slot></slot></div>
    </div>
  </div>
  <slot v-else></slot>
</template>

<script setup lang="ts">
import {computed, ref, watch} from 'vue';

const FRAME_WIDTH = 1280;
const FRAME_HEIGHT = 720;

const props = defineProps<{enabled: boolean; tracks: boolean; large?: boolean}>();
const viewport = ref<HTMLElement>();
const viewportSize = ref({width: FRAME_WIDTH, height: FRAME_HEIGHT});
const globeDiameter = computed(() => props.large ? 610 : 500);
const globeStyle = computed(() => ({width: `${globeDiameter.value}px`}));
const scale = computed(() => {
  const boardWidth = props.tracks ? 765 : globeDiameter.value;
  const boardHeight = props.tracks ? 680 : globeDiameter.value;
  return Math.min(1.65, Math.max(0, viewportSize.value.width - 24) / boardWidth, viewportSize.value.height / boardHeight);
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
