<template>
  <div
    v-if="cards.length"
    ref="hand"
    class="mission-hand"
    :class="{'mission-hand--dragging': drag?.moved, 'mission-hand--drop-play': drag?.armed}"
    role="group"
    :aria-label="$t('Cards In Hand')"
    :style="{'--hand-overlap': overlap + 'px'}"
    @keydown.esc.stop="close">
    <div v-if="canScrollBack || canScrollForward" class="mission-hand__navigation">
      <button type="button" :aria-label="$t('Previous cards')" :aria-controls="handId" :disabled="!canScrollBack"
        @click="scrollCards(-1)">‹</button>
      <button type="button" :aria-label="$t('Next cards')" :aria-controls="handId" :disabled="!canScrollForward"
        @click="scrollCards(1)">›</button>
    </div>
    <div :id="handId" ref="strip" class="mission-hand__strip" :class="{'mission-hand__strip--rows': rows.length > 1}" @scroll.passive="onScroll" @wheel="onWheel">
      <!-- A hand too wide for the screen goes on in a second (third) row, above the first one. -->
      <TransitionGroup v-for="(row, rowIndex) in rows" :key="rowIndex" name="mission-draw" tag="div" class="mission-hand__row" :style="{zIndex: rows.length - rowIndex}">
        <div v-for="{card, index, place} in row" :key="card.name" class="mission-hand__slot" :class="{'mission-hand__slot--held': inspected === card.name}" :style="fanStyle(place, row.length)">
          <div
            class="mission-hand__face"
            :class="{'mission-hand__face--raised': raised?.name === card.name && drag?.name !== card.name, 'mission-hand__face--dragged': drag?.name === card.name && drag.moved, 'mission-hand__face--armed': drag?.name === card.name && drag.armed}"
            :style="drag?.name === card.name && drag.moved ? dragStyle : raised?.name === card.name ? raised.style : undefined"
            :id="handId + '-' + index"
            aria-hidden="true"
            @pointerdown.prevent
            @click.stop="close">
            <Card :card="card" art :autoTall="raised?.name === card.name && drag?.name !== card.name" :class="{'mission-card-available': playableCards?.has(card.name)}" inert />
          </div>
          <button
            type="button"
            class="mission-hand__hit"
            :aria-label="playableCards?.has(card.name) ? $t(card.name) + ' · ' + $t('Playable now') : $t(card.name)"
            :aria-describedby="handId + '-' + index"
            :aria-pressed="inspected === card.name"
            @pointerenter="hover(card.name, $event)"
            @pointerleave="leave(card.name, 'hover')"
            @pointerdown="startDrag(card, $event)"
            @pointermove="moveDrag"
            @pointerup="endDrag"
            @pointercancel="cancelDrag"
            @focus="focusCard(card.name, $event)"
            @blur="blurCard(card.name)"
            @click="preview(card, $event)"></button>
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed, CSSProperties, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useId, watch} from 'vue';
import Card from '@/client/components/card/Card.vue';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {SoundManager} from '@/client/utils/SoundManager';

const props = defineProps<{cards: ReadonlyArray<CardModel>, playableCards?: ReadonlySet<CardName>, inspected?: CardName}>();
const emit = defineEmits<{preview: [card: CardModel, origin: DOMRect], play: [card: CardModel, origin: DOMRect]}>();
const hand = ref<HTMLDivElement>();
const strip = ref<HTMLDivElement>();
// Recent pointer positions, to tell a throw (fast upward release) from a calm drop.
// Dragging a playable card out of the zone around the hand and letting go plays it; let go
// inside the zone, the card goes back to the hand.
const ZONE_MARGIN = 70;

/** True when the pointer is outside the zone around the hand (where a card is put back). */
function outsideHandZone(x: number, y: number): boolean {
  const zone = hand.value?.getBoundingClientRect();
  if (zone === undefined) {
    return false;
  }
  return x < zone.left - ZONE_MARGIN || x > zone.right + ZONE_MARGIN || y < zone.top - ZONE_MARGIN || y > zone.bottom + ZONE_MARGIN;
}
type Drag = {name: CardName, card: CardModel, pointerId: number, startX: number, startY: number, x: number, y: number, moved: boolean, armed: boolean, origin: DOMRect};
const drag = shallowRef<Drag>();
let suppressClick = false;
const dragStyle = computed<CSSProperties>(() => {
  const d = drag.value;
  if (d === undefined) {
    return {};
  }
  // The card grows as it leaves the hand, more once letting go would play it.
  const scale = d.armed ? 0.85 : 0.62;
  return {
    '--drag-x': `${d.x - 120 * scale}px`,
    '--drag-y': `${d.y - 176 * scale}px`,
    '--drag-scale': scale,
    '--drag-tilt': `${Math.max(-12, Math.min(12, (d.x - d.startX) * 0.05))}deg`,
  };
});

function startDrag(card: CardModel, event: PointerEvent) {
  if (event.button !== 0 || !(event.currentTarget instanceof HTMLElement)) {
    return;
  }
  suppressClick = false;
  event.currentTarget.setPointerCapture(event.pointerId);
  drag.value = {name: card.name, card, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, moved: false, armed: false, origin: event.currentTarget.getBoundingClientRect()};
}

function moveDrag(event: PointerEvent) {
  const d = drag.value;
  if (d === undefined || d.pointerId !== event.pointerId) {
    return;
  }
  const moved = d.moved || Math.hypot(event.clientX - d.startX, event.clientY - d.startY) > 8;
  if (moved && !d.moved) {
    raised.value = undefined;
  }
  const armed = moved && outsideHandZone(event.clientX, event.clientY) && (props.playableCards?.has(d.name) ?? false);
  drag.value = {...d, x: event.clientX, y: event.clientY, moved, armed};
}

function endDrag(event: PointerEvent) {
  const d = drag.value;
  if (d === undefined || d.pointerId !== event.pointerId) {
    return;
  }
  drag.value = undefined;
  if (!d.moved) {
    return;
  }
  suppressClick = true;
  if (d.armed) {
    SoundManager.mission('card');
    emit('play', d.card, new DOMRect(event.clientX - 60, event.clientY - 88, 120, 176));
  }
  // Otherwise the card goes back to the hand.
}

function cancelDrag() {
  drag.value = undefined;
}
const handId = useId();
type Source = 'hover' | 'focus';
type RaisedCard = {name: CardName, anchor: HTMLElement, source: Source, style: CSSProperties};
const raised = shallowRef<RaisedCard>();

function fanStyle(index: number, count: number): CSSProperties {
  const middle = (count - 1) / 2;
  const offset = (index - middle) / Math.max(1, middle);
  // Each card lies on top of the next one, so where cards overlap the right side of every card
  // (its tags) stays visible.
  return {'--card-tilt': `${offset * 5}deg`, '--card-drop': `${Math.abs(offset) * 6}px`, 'zIndex': count - index};
}

/** How many rows the hand takes: more cards than fit side by side go on in rows above. */
const rowCount = ref(1);
const MAX_ROWS = 3;
/** The cards by row (first row at the bottom), each with its index in the hand and its place in the row. */
const rows = computed(() => {
  const count = rowCount.value;
  const perRow = Math.ceil(props.cards.length / count);
  const result: Array<Array<{card: CardModel, index: number, place: number}>> = [];
  props.cards.forEach((card, index) => {
    const row = Math.floor(index / perRow);
    (result[row] ??= []).push({card, index, place: index % perRow});
  });
  return result;
});

function position(anchor: HTMLElement): CSSProperties {
  const slot = anchor.getBoundingClientRect();
  const face = anchor.parentElement?.querySelector<HTMLElement>('.mission-hand__face');
  const width = face?.offsetWidth || 240;
  const height = face?.offsetHeight || 352;
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
  // Hovered cards grow when the screen allows it, and sit above the hand so they never hide the
  // other cards in it (only on a very short screen may the card come down over the hand).
  const room = slot.top - 24;
  const scale = Math.max(0.01, Math.min(1.45, (viewportWidth - 24) / width, Math.max(0.9, room / height), (slot.bottom - 24) / height));
  const left = Math.max(12, Math.min(slot.left + (slot.width - width * scale) / 2, viewportWidth - width * scale - 12));
  const top = Math.max(12, slot.top - height * scale - 12);
  return {
    '--lift-x': `${left}px`,
    '--lift-y': `${top}px`,
    '--lift-scale': scale,
    '--lift-from-x': `${slot.left - left}px`,
    '--lift-from-y': `${slot.top - top}px`,
  };
}

function lift(name: CardName, event: Event, source: Source) {
  const anchor = event.currentTarget;
  if (!(anchor instanceof HTMLElement)) {
    return;
  }
  raised.value = {name, anchor, source, style: position(anchor)};
  // Measure again after the same card has expanded to fit its full text.
  void nextTick(reposition);
}

function hover(name: CardName, event: PointerEvent) {
  if (event.pointerType === 'mouse' && raised.value?.name !== name && drag.value === undefined && props.inspected === undefined) {
    lift(name, event, 'hover');
  }
}

function focusCard(name: CardName, event: FocusEvent) {
  if (event.currentTarget instanceof HTMLElement && event.currentTarget.matches(':focus-visible')) {
    lift(name, event, 'focus');
  }
}

function preview(card: CardModel, event: MouseEvent) {
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  const face = (event.currentTarget as HTMLElement | null)?.parentElement?.querySelector('.mission-hand__face');
  const origin = (face ?? event.currentTarget as HTMLElement).getBoundingClientRect();
  close();
  SoundManager.mission('card');
  emit('preview', card, origin);
}

function leave(name: CardName, source: Source) {
  if (raised.value?.name === name && raised.value.source === source) {
    close();
  }
}

function blurCard(name: CardName) {
  leave(name, 'focus');
}

function close() {
  raised.value = undefined;
}

function reposition() {
  const card = raised.value;
  if (card === undefined) {
    return;
  }
  const bounds = strip.value?.getBoundingClientRect();
  const slot = card.anchor.getBoundingClientRect();
  if (!bounds || slot.right <= bounds.left || slot.left >= bounds.right) {
    close();
  } else {
    raised.value = {...card, style: position(card.anchor)};
  }
}

function closeOutside(event: PointerEvent) {
  if (event.target instanceof Element && !event.target.closest('.mission-hand')) {
    close();
  }
}

watch(() => props.inspected, (name) => {
  if (name !== undefined) {
    close();
  }
});

watch(() => props.cards, (cards) => {
  const name = raised.value?.name;
  if (name === undefined) {
    return;
  }
  if (cards.some((card) => card.name === name)) {
    reposition();
  } else {
    close();
  }
}, {flush: 'post'});

const overlap = ref(0);
const canScrollBack = ref(false);
const canScrollForward = ref(false);

function updateScrollBounds() {
  const row = strip.value;
  canScrollBack.value = row !== undefined && row.scrollLeft > 1;
  canScrollForward.value = row !== undefined && row.scrollLeft + row.clientWidth < row.scrollWidth - 1;
}

function onScroll() {
  updateScrollBounds();
  if (raised.value?.source === 'hover') {
    close();
  } else {
    reposition();
  }
}

function scrollCards(direction: number) {
  const row = strip.value;
  if (row && !drag.value) {
    row.scrollBy({left: direction * row.clientWidth * 0.8});
  }
}

function onWheel(event: WheelEvent) {
  const row = strip.value;
  if (!row || drag.value || event.ctrlKey || event.deltaX !== 0 || event.deltaY === 0 ||
    !(event.deltaY < 0 ? canScrollBack.value : canScrollForward.value)) {
    return;
  }
  event.preventDefault();
  const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? row.clientWidth : 1;
  row.scrollLeft += event.deltaY * unit;
}

function fitHand() {
  const row = strip.value;
  const slot = row?.querySelector<HTMLElement>('.mission-hand__slot');
  const total = props.cards.length;
  let inset = 0;
  let rowsNeeded = 1;
  if (row && slot && total > 1) {
    const style = getComputedStyle(row);
    // Never wider than what is left of the screen, even if the dock around the hand is wider.
    const box = row.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const visibleWidth = Math.min(row.clientWidth, viewportWidth - Math.max(0, box.left) - 8);
    const available = visibleWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const gap = parseFloat(style.columnGap) || 0;
    const width = slot.getBoundingClientRect().width;
    const insetFor = (count: number) => count < 2 ? 0 : Math.max(0, (count * width + (count - 1) * gap - available) / (count - 1));
    // Phones keep one swipeable row so long hands do not cover the board.
    const maxRows = window.matchMedia?.('(max-width: 760px)').matches ? 1 : MAX_ROWS;
    const comfortable = width * 0.55;
    while (rowsNeeded < maxRows && insetFor(Math.ceil(total / rowsNeeded)) > comfortable) {
      rowsNeeded++;
    }
    // Keep a 44px target visible on each card, then scroll the rest of the hand.
    inset = Math.min(insetFor(Math.ceil(total / rowsNeeded)), Math.max(0, width + gap - 44));
  }
  rowCount.value = rowsNeeded;
  overlap.value = inset;
  void nextTick(updateScrollBounds);
}
let observer: ResizeObserver | undefined;
watch(strip, (row) => {
  observer?.disconnect();
  if (row && typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(fitHand);
    observer.observe(row);
  }
  fitHand();
}, {flush: 'post'});
watch(() => props.cards.length, fitHand, {flush: 'post'});

function fitOnResize() {
  fitHand();
}

onMounted(() => {
  document.addEventListener('pointerdown', closeOutside);
  window.addEventListener('resize', reposition);
  window.addEventListener('resize', fitOnResize);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeOutside);
  window.removeEventListener('resize', reposition);
  window.removeEventListener('resize', fitOnResize);
  observer?.disconnect();
});
</script>

<style lang="less">
.mission-hand__navigation {
  position: absolute;
  z-index: 3;
  inset: 1px 10px auto auto;
  display: flex;
  gap: 5px;

  button {
    display: grid;
    width: 36px;
    height: 31px;
    place-items: center;
    padding: 0;
    border: 1px solid #8ca5af;
    border-radius: 5px;
    background: #142630;
    color: #eef6f8;
    font-size: 1.5rem;
    line-height: 1;
    cursor: pointer;

    &:hover:not(:disabled),
    &:focus-visible {
      border-color: #f1be80;
    }

    &:disabled {
      opacity: 0.4;
      cursor: default;
    }
  }
}

.mission-hand__slot:has(.mission-hand__face--raised, .mission-hand__face--dragged) {
  // The lifted or dragged card stays above its neighbours.
  z-index: 1000 !important;
}

.mission-hand__slot + .mission-hand__slot {
  margin-left: calc(-1 * var(--hand-overlap, 0px));
}

// Rows of a big hand: the first row at the bottom, the next ones above it, partly behind it, so
// the top of every card (name, cost, tags) stays in view.
.mission-hand__strip--rows {
  flex-direction: column-reverse;
  align-items: stretch;
}

.mission-hand__row {
  position: relative;
  display: flex;
  min-width: 0;
  gap: inherit;

  .mission-hand__strip--rows > & + & {
    margin-bottom: calc(-0.5 * 352px * var(--hand-scale));
  }
}

// The row with the lifted or dragged card comes in front of the other rows.
.mission-hand__row:has(.mission-hand__face--raised, .mission-hand__face--dragged) {
  z-index: 1000 !important;
}

// While a card is dragged: the zone around the hand where letting go puts it back.
.mission-hand--dragging {
  outline: 2px dashed #e2c27f99;
  outline-offset: 70px;
  border-radius: 18px;
  transition: outline-color 120ms ease;
}

// Out of the zone with a playable card: letting go plays it.
.mission-hand--drop-play {
  outline-color: #3cf59a66;
}
</style>
