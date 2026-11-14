<template>
  <div v-if="enabled && !tracks && webgl" ref="viewport" class="mars-surface mars-surface--scene" :class="{'mars-surface--dragging': dragging}"
    @pointerdown="startPointer" @pointermove="movePointer" @pointerup="endPointer" @pointercancel="endPointer" @lostpointercapture="endPointer" @pointerleave="leavePointer"
    @click.capture="suppressDragClick" @wheel="wheelZoom">
    <canvas ref="canvas" class="mars-surface__canvas" aria-hidden="true"></canvas>
    <div ref="safeArea" class="mars-surface__safe" aria-hidden="true"></div>
    <div class="mars-surface__overlay"><slot></slot></div>
  </div>
  <div v-else-if="enabled" ref="viewport" class="mars-surface">
    <div class="mars-surface__frame" :style="frameStyle">
      <div class="mars-surface__board"><slot></slot></div>
    </div>
  </div>
  <slot v-else></slot>
</template>

<script setup lang="ts">
import {computed, onBeforeUnmount, ref, shallowRef, watch} from 'vue';
import {Climate, MarsScene, SafeArea, supportsWebGL} from '@/client/components/board/mars/MarsScene';
import {SpaceModel} from '@/common/models/SpaceModel';
import {SpaceType} from '@/common/boards/SpaceType';
import {SpaceId} from '@/common/Types';

const FRAME_WIDTH = 1280;
const FRAME_HEIGHT = 720;

const props = defineProps<{
  enabled: boolean;
  tracks: boolean;
  large?: boolean;
  spaces?: ReadonlyArray<SpaceModel>;
  legalSpaces?: ReadonlyArray<SpaceId>;
  inspectedSpace?: SpaceId;
  orbitDock?: HTMLElement;
  /** Global parameters as 0..1, for the planet's climate. */
  climate?: Climate;
}>();
const emit = defineEmits<{'cameraChanged': []}>();
const webgl = typeof window !== 'undefined' && supportsWebGL();
const viewport = ref<HTMLElement>();
const canvas = ref<HTMLCanvasElement>();
const safeArea = ref<HTMLElement>();
const scene = shallowRef<MarsScene>();
const viewportSize = ref({width: FRAME_WIDTH, height: FRAME_HEIGHT});
const dragging = ref(false);
const pointers = new Map<number, {x: number; y: number}>();
let ignoreClick = false;
const reducedMotionQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : undefined;

// The tracks view keeps the classic flat board scaled into the stage.
const scale = computed(() => Math.max(0.05, Math.min((viewportSize.value.width - 16) / 765, viewportSize.value.height / 680)));
const frameStyle = computed(() => ({
  width: `${FRAME_WIDTH}px`,
  height: `${FRAME_HEIGHT}px`,
  transform: `translate(-50%, -50%) scale(${scale.value})`,
}));

/** The safe area is a hidden box positioned by CSS, so it follows the HUD layout at every width. */
function readSafeArea(element: HTMLElement): SafeArea {
  const outer = element.getBoundingClientRect();
  const inner = safeArea.value?.getBoundingClientRect();
  if (inner === undefined || inner.width <= 0 || inner.height <= 0) {
    return {top: 0, right: 0, bottom: 0, left: 0};
  }
  return {top: inner.top - outer.top, right: outer.right - inner.right, bottom: outer.bottom - inner.bottom, left: inner.left - outer.left};
}

/** Lays every DOM space and orbital station onto the surface with the camera that draws it. */
function layout() {
  const current = scene.value;
  const element = viewport.value;
  if (current === undefined || element === undefined) {
    return;
  }
  for (const space of element.querySelectorAll<HTMLElement>('#main_board > [data_space_id]')) {
    const transform = current.spaceTransform(space.getAttribute('data_space_id') as SpaceId);
    if (transform === undefined) {
      continue;
    }
    const [a, b, c, d] = transform.matrix;
    space.style.transform = `matrix(${transform.matrix.map((n) => n.toFixed(4)).join(',')})`;
    // Markers inside a space keep a readable size whatever the zoom.
    // Only touch the custom property when it changes noticeably, as it restyles the space's children.
    const spaceScale = Math.sqrt(Math.abs(a * d - b * c));
    const previous = Number(space.dataset.spaceScale ?? 0);
    if (Math.abs(spaceScale - previous) > previous * 0.03) {
      space.dataset.spaceScale = spaceScale.toFixed(3);
      space.style.setProperty('--space-scale', spaceScale.toFixed(3));
    }
    space.style.visibility = transform.visible ? '' : 'hidden';
  }
  const dock = props.orbitDock;
  if (dock) {
    const bounds = element.getBoundingClientRect();
    const dockBounds = dock.getBoundingClientRect();
    for (const station of current.orbitalScreen()) {
      const button = dock.querySelector<HTMLElement>(`[data_space_id="${station.id}"]`);
      if (!button) {
        continue;
      }
      const size = Math.max(64, Math.min(150, station.size * 2.4));
      button.style.width = `${size}px`;
      button.style.height = `${size}px`;
      button.style.transform = `translate(${(bounds.left - dockBounds.left + station.x - size / 2).toFixed(1)}px, ${(bounds.top - dockBounds.top + station.y - size / 2).toFixed(1)}px)`;
      button.style.visibility = station.visible ? '' : 'hidden';
    }
  }
  emit('cameraChanged');
}

function updateHighlights() {
  scene.value?.setHighlights(props.spaces ?? [], new Set(props.legalSpaces ?? []), props.inspectedSpace);
}

function resize() {
  const element = viewport.value;
  if (element === undefined) {
    return;
  }
  viewportSize.value = {width: element.clientWidth, height: element.clientHeight};
  scene.value?.setSize(element.clientWidth, element.clientHeight, readSafeArea(element));
}

watch(canvas, (element, _previous, cleanup) => {
  if (element === undefined) {
    return;
  }
  const created = new MarsScene(element, props.large ?? false, reducedMotionQuery?.matches ?? false, layout);
  scene.value = created;
  // Diagnostics: /player?id=...&scene-debug exposes the scene for measurements in the console.
  if (window.location.search.includes('scene-debug')) {
    (window as unknown as {marsScene?: MarsScene}).marsScene = created;
  }
  resize();
  created.setSpaces(props.spaces ?? []);
  created.setOrbitals((props.spaces ?? []).filter((space) => space.spaceType === SpaceType.COLONY).map((space) => space.id));
  updateHighlights();
  if (props.climate) {
    created.setClimate(props.climate);
  }
  const motion = (event: MediaQueryListEvent) => created.setReducedMotion(event.matches);
  reducedMotionQuery?.addEventListener('change', motion);
  cleanup(() => {
    reducedMotionQuery?.removeEventListener('change', motion);
    created.dispose();
    if (scene.value === created) {
      scene.value = undefined;
    }
  });
}, {flush: 'post'});

watch(() => props.spaces, (spaces) => scene.value?.setSpaces(spaces ?? []));
watch(() => props.climate, (climate) => climate && scene.value?.setClimate(climate), {deep: true});
watch([() => props.spaces, () => props.legalSpaces, () => props.inspectedSpace], updateHighlights);
watch(() => props.orbitDock, () => layout(), {flush: 'post'});

watch(viewport, (element, _previous, cleanup) => {
  if (!element) {
    return;
  }
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    cleanup(() => observer.disconnect());
  } else {
    window.addEventListener('resize', resize);
    cleanup(() => window.removeEventListener('resize', resize));
  }
  resize();
}, {flush: 'post'});

onBeforeUnmount(() => scene.value?.dispose());

function local(event: {clientX: number, clientY: number}) {
  const bounds = viewport.value?.getBoundingClientRect();
  return {x: event.clientX - (bounds?.left ?? 0), y: event.clientY - (bounds?.top ?? 0)};
}

function startPointer(event: PointerEvent) {
  if (event.button !== 0) {
    return;
  }
  if (pointers.size === 0) {
    ignoreClick = false;
  }
  pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
}

function movePointer(event: PointerEvent) {
  const previous = pointers.get(event.pointerId);
  if (previous === undefined || !viewport.value || scene.value === undefined) {
    return;
  }
  const other = [...pointers.entries()].find(([id]) => id !== event.pointerId)?.[1];
  const dx = event.clientX - previous.x;
  const dy = event.clientY - previous.y;
  if (!dragging.value && other === undefined && Math.hypot(dx, dy) < 6) {
    return;
  }
  viewport.value.setPointerCapture(event.pointerId);
  dragging.value = true;
  ignoreClick = true;
  pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
  const from = local({clientX: previous.x, clientY: previous.y});
  if (other === undefined) {
    const to = local(event);
    scene.value.panPixels(from.x, from.y, to.x, to.y);
    return;
  }
  const before = Math.hypot(previous.x - other.x, previous.y - other.y);
  const after = Math.hypot(event.clientX - other.x, event.clientY - other.y);
  const middle = local({clientX: (event.clientX + other.x) / 2, clientY: (event.clientY + other.y) / 2});
  scene.value.panPixels(from.x, from.y, from.x + dx / 2, from.y + dy / 2);
  scene.value.zoomAt(after / Math.max(1, before), middle.x, middle.y);
}

function endPointer(event: PointerEvent) {
  pointers.delete(event.pointerId);
  dragging.value = pointers.size > 0 && dragging.value;
}

function leavePointer(event: PointerEvent) {
  if (!viewport.value?.hasPointerCapture(event.pointerId)) {
    endPointer(event);
  }
}

function suppressDragClick(event: MouseEvent) {
  if (ignoreClick && event.detail > 0) {
    event.preventDefault();
    event.stopPropagation();
    ignoreClick = false;
  }
}

function wheelZoom(event: WheelEvent) {
  if (scene.value === undefined) {
    return;
  }
  event.preventDefault();
  const delta = event.deltaY * (event.deltaMode === 1 ? 16 : 1);
  const point = local(event);
  scene.value.zoomAt(Math.exp(-delta * 0.0016), point.x, point.y);
}

function pan(x: number, y: number) {
  scene.value?.pan(x, y);
}

function zoomBy(factor: number) {
  scene.value?.zoomAt(factor);
}

function resetCamera() {
  scene.value?.reset();
}

function reveal(element: HTMLElement) {
  const id = element.getAttribute('data_space_id') as SpaceId | null;
  if (id !== null) {
    scene.value?.reveal(id);
  }
}

defineExpose({pan, zoomBy, resetCamera, reveal});
</script>

<style lang="less">
// Owned spaces on the 3D surface: the planet shader draws the owner's colour as the space border.
// The old ring inside the space is an option (Settings: tile ownership).
body.preferences_map_owner_ring #player-home.mission-cinematic #main_board.board--scene {
  > .board-space[class*='atlas-owner--']::before {
    position: absolute;
    z-index: 2;
    inset: 3px;
    background: var(--atlas-owner-color, #fff);
    clip-path: polygon(evenodd, 50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%, 50% 0%, 50% 6%, 5% 28%, 5% 72%, 50% 94%, 95% 72%, 95% 28%, 50% 6%);
    content: '';
    filter: drop-shadow(0 0 2px #000);
    opacity: 0.85;
    pointer-events: none;
  }
}

body #player-home.mission-cinematic #main_board.board--scene {
  .board-cube {
    --marker: min(15px, calc(17px / var(--space-scale, 1)));
    z-index: 3;
    border: 2px solid #fff;
    box-shadow: 0 0 0 1px #000a, 0 0 8px var(--atlas-owner-color, #fff);
  }
}
</style>
