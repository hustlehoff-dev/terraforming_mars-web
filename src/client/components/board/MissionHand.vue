<template>
  <TransitionGroup
    v-if="cards.length"
    name="mission-draw"
    tag="div"
    class="mission-hand"
    role="group"
    :aria-label="$t('Cards In Hand')"
    :style="{'--hand-overlap': overlap + 'px'}"
    @scroll.passive="reposition"
    @keydown.esc.stop="close">
    <div v-for="(card, index) in cards" :key="card.name" class="mission-hand__slot" :class="{'mission-hand__slot--held': inspected === card.name}" :style="fanStyle(index)">
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
</template>

<script setup lang="ts">
import {computed, CSSProperties, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useId, watch} from 'vue';
import Card from '@/client/components/card/Card.vue';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {SoundManager} from '@/client/utils/SoundManager';

const props = defineProps<{cards: ReadonlyArray<CardModel>, playableCards?: ReadonlySet<CardName>, inspected?: CardName}>();
const emit = defineEmits<{preview: [card: CardModel, origin: DOMRect], play: [card: CardModel, origin: DOMRect], pin: [card: CardModel, x: number, y: number]}>();
// Recent pointer positions, to tell a throw (fast upward release) from a calm drop.
let trail: Array<{x: number, y: number, t: number}> = [];
const THROW_SPEED = 0.9; // px per ms upwards

// Dragging a playable card up out of the hand and letting go over the board plays it.
const PLAY_LIFT = 90;
type Drag = {name: CardName, card: CardModel, pointerId: number, startX: number, startY: number, x: number, y: number, moved: boolean, armed: boolean, origin: DOMRect};
const drag = shallowRef<Drag>();
let suppressClick = false;
const dragStyle = computed<CSSProperties>(() => {
  const d = drag.value;
  if (d === undefined) {
    return {};
  }
  const scale = d.armed ? 0.62 : 0.5;
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
  trail = [{x: event.clientX, y: event.clientY, t: performance.now()}];
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
  const now = performance.now();
  trail = [...trail.filter((point) => now - point.t < 120), {x: event.clientX, y: event.clientY, t: now}];
  const armed = moved && d.origin.top - event.clientY > PLAY_LIFT && (props.playableCards?.has(d.name) ?? false);
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
  const first = trail[0];
  const elapsed = first ? Math.max(1, performance.now() - first.t) : 1;
  const upwardSpeed = first ? (first.y - event.clientY) / elapsed : 0;
  if (d.armed && upwardSpeed > THROW_SPEED) {
    SoundManager.mission('card');
    emit('play', d.card, new DOMRect(event.clientX - 60, event.clientY - 88, 120, 176));
  } else if (d.origin.top - event.clientY > 40) {
    // Calmly put down above the hand: the card stays there.
    emit('pin', d.card, event.clientX, event.clientY);
  }
}

function cancelDrag() {
  drag.value = undefined;
}
const handId = useId();
type Source = 'hover' | 'focus';
type RaisedCard = {name: CardName, anchor: HTMLElement, source: Source, style: CSSProperties};
const raised = shallowRef<RaisedCard>();

function fanStyle(index: number): CSSProperties {
  const middle = (props.cards.length - 1) / 2;
  const offset = (index - middle) / Math.max(1, middle);
  // Each card lies on top of the next one, so where cards overlap the right side of every card
  // (its tags) stays visible.
  return {'--card-tilt': `${offset * 5}deg`, '--card-drop': `${Math.abs(offset) * 6}px`, 'zIndex': props.cards.length - index};
}

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
  const strip = card.anchor.closest('.mission-hand')?.getBoundingClientRect();
  const slot = card.anchor.getBoundingClientRect();
  if (!strip || slot.right < strip.left || slot.left > strip.right) {
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

// Many cards: they overlap (like a hand of cards) so every card stays on screen, no scrolling.
const overlap = ref(0);
const instance = getCurrentInstance();
function fitHand() {
  const root = instance?.proxy?.$el as HTMLElement | undefined;
  const slot = root?.querySelector?.('.mission-hand__slot');
  if (!(root instanceof HTMLElement) || !(slot instanceof HTMLElement) || props.cards.length < 2) {
    overlap.value = 0;
    return;
  }
  const style = getComputedStyle(root);
  const available = root.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const gap = parseFloat(style.columnGap) || 0;
  const count = props.cards.length;
  const needed = count * slot.offsetWidth + (count - 1) * gap;
  // More than half of every card stays visible; beyond that the hand scrolls instead.
  const fit = needed > available ? Math.ceil((needed - available) / (count - 1)) + 1 : 0;
  overlap.value = Math.min(fit, Math.floor(slot.offsetWidth * 0.45));
}
let observer: ResizeObserver | undefined;
watch(() => props.cards.length, () => nextTick(fitHand));

onMounted(() => {
  document.addEventListener('pointerdown', closeOutside);
  window.addEventListener('resize', reposition);
  const root = instance?.proxy?.$el;
  if (root instanceof HTMLElement && typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => fitHand());
    observer.observe(root);
  }
  nextTick(fitHand);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeOutside);
  window.removeEventListener('resize', reposition);
  observer?.disconnect();
});
</script>

<style lang="less">
// The hand takes all the room left in the dock (its width must not follow the overlap, or the
// cards would keep squeezing together).
.mission-player-hud > .mission-hand {
  flex: 1 1 0;
  min-width: 0;
  // Only with a very large hand: a thin visible scrollbar, so no card is hidden without a hint.
  scrollbar-width: thin !important;
  scrollbar-color: #8f796099 transparent;
}

.mission-hand__slot:has(.mission-hand__face--raised, .mission-hand__face--dragged) {
  // The lifted or dragged card stays above its neighbours.
  z-index: 1000 !important;
}

.mission-hand__slot + .mission-hand__slot {
  margin-left: calc(-1 * var(--hand-overlap, 0px));
}
</style>
