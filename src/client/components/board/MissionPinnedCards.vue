<template>
  <div class="mission-pins">
    <div v-for="card in pinnedCards" :key="card.name" class="mission-pins__card"
      :class="{'mission-pins__card--moving': moving?.name === card.name}"
      :style="positionOf(card.name)"
      @pointerdown="startMove(card, $event)" @pointermove="move" @pointerup="endMove(card, $event)" @pointercancel="moving = undefined">
      <Card :card="card" art :class="{'mission-card-available': playableCards?.has(card.name)}" inert />
      <button type="button" class="mission-pins__back" :title="$t('Back to hand')" :aria-label="$t('Back to hand')"
        @pointerdown.stop @click.stop="unpin(card.name)">×</button>
    </div>
    <div class="mission-pins__presets" role="group" :aria-label="$t('Card layouts')">
      <button type="button" class="mission-pins__save" :class="{'mission-pins__save--on': saving}" :aria-pressed="saving"
        :title="$t('Save the layout: click, then pick a slot')" @click="saving = !saving">💾</button>
      <button v-for="slot in [0, 1, 2]" :key="slot" type="button" class="mission-pins__slot"
        :class="{'mission-pins__slot--filled': presets[slot] !== undefined}"
        :title="saving ? $t('Save layout') + ' ' + (slot + 1) : $t('Load layout') + ' ' + (slot + 1)"
        @click="usePreset(slot)">{{ slot + 1 }}</button>
      <button type="button" class="mission-pins__slot" :title="$t('Return all cards to the hand')" @click="reset">⟲</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed, ref, watch} from 'vue';
import Card from '@/client/components/card/Card.vue';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';

/*
 * Cards taken out of the hand and left anywhere on the game view. They stay where they were put
 * (remembered per player in this browser), can be moved again, opened like a hand card with a
 * click, or sent back to the hand. Three layout slots save and restore where the cards lie.
 */
const props = defineProps<{cards: ReadonlyArray<CardModel>, playerId: string, playableCards?: ReadonlySet<CardName>}>();
const emit = defineEmits<{preview: [card: CardModel, origin: DOMRect], change: [names: ReadonlySet<CardName>]}>();

type Layout = Partial<Record<CardName, {x: number, y: number}>>;
const storageKey = computed(() => `mission-pins:${props.playerId}`);
const PRESETS_KEY = 'mission-pin-presets';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Remembering the layout is optional.
  }
}

const pins = ref<Layout>(read(storageKey.value, {}));
const presets = ref<Array<Layout | undefined>>(read(PRESETS_KEY, [undefined, undefined, undefined]));
const saving = ref(false);

const inHand = computed(() => new Set(props.cards.map((card) => card.name)));
const pinnedCards = computed(() => props.cards.filter((card) => pins.value[card.name] !== undefined));

// Cards that left the hand (played, sold) lose their place on the table.
watch(inHand, (names) => {
  const next: Layout = {};
  for (const [name, position] of Object.entries(pins.value)) {
    if (names.has(name as CardName) && position) {
      next[name as CardName] = position;
    }
  }
  if (Object.keys(next).length !== Object.keys(pins.value).length) {
    pins.value = next;
  }
});

watch(pins, (layout) => {
  write(storageKey.value, layout);
  emit('change', new Set(Object.keys(layout) as CardName[]));
}, {deep: true, immediate: true});

function positionOf(name: CardName) {
  const position = pins.value[name] ?? {x: 0.5, y: 0.4};
  return {left: `${position.x * 100}%`, top: `${position.y * 100}%`};
}

function clamp(value: number) {
  return Math.max(0.02, Math.min(0.92, value));
}

/** Puts a card from the hand at a point of the view (client pixels). */
function pin(name: CardName, clientX: number, clientY: number) {
  pins.value = {...pins.value, [name]: {x: clamp(clientX / window.innerWidth - 0.06), y: clamp(clientY / window.innerHeight - 0.1)}};
}

function unpin(name: CardName) {
  const next = {...pins.value};
  delete next[name];
  pins.value = next;
}

function reset() {
  pins.value = {};
}

function usePreset(slot: number) {
  if (saving.value) {
    const next = [...presets.value];
    next[slot] = {...pins.value};
    presets.value = next;
    write(PRESETS_KEY, next);
    saving.value = false;
    return;
  }
  const layout = presets.value[slot];
  if (layout === undefined) {
    return;
  }
  const next: Layout = {};
  for (const [name, position] of Object.entries(layout)) {
    if (inHand.value.has(name as CardName) && position) {
      next[name as CardName] = position;
    }
  }
  pins.value = next;
}

// Moving a card on the table; a click without moving opens it.
const moving = ref<{name: CardName, startX: number, startY: number, moved: boolean, dx: number, dy: number}>();
function startMove(card: CardModel, event: PointerEvent) {
  if (event.button !== 0 || !(event.currentTarget instanceof HTMLElement)) {
    return;
  }
  event.currentTarget.setPointerCapture(event.pointerId);
  const box = event.currentTarget.getBoundingClientRect();
  moving.value = {name: card.name, startX: event.clientX, startY: event.clientY, moved: false, dx: event.clientX - box.left, dy: event.clientY - box.top};
}
function move(event: PointerEvent) {
  const m = moving.value;
  if (m === undefined) {
    return;
  }
  const moved = m.moved || Math.hypot(event.clientX - m.startX, event.clientY - m.startY) > 6;
  if (moved) {
    pins.value = {...pins.value, [m.name]: {x: clamp((event.clientX - m.dx) / window.innerWidth), y: clamp((event.clientY - m.dy) / window.innerHeight)}};
  }
  moving.value = {...m, moved};
}
function endMove(card: CardModel, event: PointerEvent) {
  const m = moving.value;
  moving.value = undefined;
  if (m !== undefined && !m.moved && event.currentTarget instanceof HTMLElement) {
    emit('preview', card, event.currentTarget.getBoundingClientRect());
  }
}

defineExpose({pin});
</script>

<style scoped lang="less">
.mission-pins {
  position: fixed;
  z-index: 20;
  inset: 0;
  pointer-events: none;
}

.mission-pins__card {
  position: absolute;
  cursor: grab;
  pointer-events: auto;
  touch-action: none;
  filter: drop-shadow(0 12px 18px #000b);
  transition: filter 120ms ease;

  :deep(.card-container) {
    margin: 0;
    zoom: 0.65;
  }

  &:hover {
    filter: drop-shadow(0 0 10px #e2c27f99) drop-shadow(0 12px 18px #000b);
  }

  &--moving {
    cursor: grabbing;
    filter: drop-shadow(0 22px 28px #000d);
  }
}

.mission-pins__back {
  position: absolute;
  z-index: 5;
  top: -8px;
  right: -8px;
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border: 1px solid #6f8c98;
  border-radius: 50%;
  background: #0b141c;
  color: #eef6f8;
  font-size: 0.9rem;
  opacity: 0;
  cursor: pointer;
  transition: opacity 120ms ease;
}

.mission-pins__card:hover .mission-pins__back {
  opacity: 1;
}

// Subtle layout controls just above the hand.
.mission-pins__presets {
  position: absolute;
  left: 50%;
  bottom: calc(var(--dock-height, 240px) + 4px);
  display: flex;
  gap: 4px;
  opacity: 0.45;
  pointer-events: auto;
  transform: translateX(-50%);
  transition: opacity 140ms ease;

  &:hover,
  &:focus-within {
    opacity: 1;
  }
}

.mission-pins__save,
.mission-pins__slot {
  min-width: 26px;
  height: 24px;
  padding: 0 6px;
  border: 1px solid #6f8c9888;
  border-radius: 5px;
  background: #0b141ccc;
  color: #cfe0e6;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
}

.mission-pins__slot--filled {
  border-color: #e2c27f;
  color: #ffe9bd;
}

.mission-pins__save--on {
  border-color: #e2c27f;
  background: #5a4116;
}
</style>
