<template>
  <div v-if="effectCards.length" class="mission-effects" :aria-label="$t('Card effects')" role="group">
    <button type="button" class="mission-effects__title" :title="$t('Show the cards with effects and actions')" aria-haspopup="dialog" @click="openWindow()">
      {{ $t('Effects') }} · {{ effectCards.length }} <span aria-hidden="true">⤢</span>
    </button>
    <div class="mission-effects__list">
      <button v-for="card in effectCards" :key="card.name" type="button" class="mission-effects__card"
        :class="{'mission-effects__card--lit': lit.has(card.name), 'mission-effects__card--usable': usable?.has(card.name)}"
        :title="$t(card.name)" aria-haspopup="dialog"
        @click="openWindow(card)"
        @pointerenter="hovered = card" @pointerleave="hovered = undefined" @focus="hovered = card" @blur="hovered = undefined">
        <Card :card="card" inert />
      </button>
    </div>
    <div v-if="hovered" class="mission-effects__preview" aria-hidden="true">
      <Card :card="hovered" autoTall />
      <span v-if="usable?.has(hovered.name)" class="mission-effects__hint" v-i18n>Action available</span>
    </div>

    <!-- The cards with effects and actions, large; an action that can be used now has its button. -->
    <dialog ref="dialog" class="mission-effects-window" :aria-label="$t('Effects')" @click.self="closeWindow" @close="focused = undefined">
      <header>
        <h2>{{ $t('Effects') }} · {{ effectCards.length }}</h2>
        <span v-if="usableCards.length" class="mission-effects-window__count">{{ $t('Actions available') }}: {{ usableCards.length }}</span>
      </header>
      <div class="mission-effects-window__cards">
        <div v-for="card in windowCards" :key="card.name" class="mission-effects-window__card"
          :class="{'mission-effects-window__card--usable': usable?.has(card.name), 'mission-effects-window__card--focused': focused === card.name}">
          <Card :card="card" autoTall />
          <button v-if="usable?.has(card.name)" type="button" class="mission-effects-window__use" @click="useAction(card)">{{ $t('Use action') }}</button>
        </div>
      </div>
      <footer class="mission-window-footer">
        <button type="button" class="mission-close" @click="closeWindow" v-i18n>Close</button>
      </footer>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import {computed, ref} from 'vue';
import Card from '@/client/components/card/Card.vue';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {getCard} from '@/client/cards/ClientCardManifest';

/*
 * The player's played cards that keep working: the corporation, preludes, CEO, active cards and
 * any card with an ongoing effect or action ("When any city tile is placed..."), small, in the dock. Hover shows the card; a card glows for a moment when its effect gives something.
 */
const props = defineProps<{tableau: ReadonlyArray<CardModel>, lit: ReadonlySet<CardName>, usable?: ReadonlySet<CardName>}>();
const emit = defineEmits<{use: [card: CardModel], openAll: []}>();
const hovered = ref<CardModel>();
const dialog = ref<HTMLDialogElement>();
/** The card clicked in the bar: shown first and outlined in the window. */
const focused = ref<CardName>();

function openWindow(card?: CardModel) {
  hovered.value = undefined;
  focused.value = card?.name;
  const window = dialog.value;
  if (window !== undefined && !window.open && typeof window.showModal === 'function') {
    window.showModal();
  }
}

function closeWindow() {
  if (typeof dialog.value?.close === 'function') {
    dialog.value.close();
  }
}

function useAction(card: CardModel) {
  closeWindow();
  emit('use', card);
}

const effectCache = new Map<CardName, boolean>();
function hasEffect(name: CardName): boolean {
  let known = effectCache.get(name);
  if (known === undefined) {
    known = JSON.stringify(getCard(name)?.metadata.renderData ?? '').includes('"is":"effect"');
    effectCache.set(name, known);
  }
  return known;
}

/** Corporation and preludes first (the player's starting cards), then the rest in play order. */
const ALWAYS: ReadonlyArray<CardType> = [CardType.CORPORATION, CardType.PRELUDE, CardType.CEO, CardType.ACTIVE];
function rank(card: CardModel): number {
  const type = getCard(card.name)?.type;
  return type === CardType.CORPORATION ? 0 : type === CardType.PRELUDE ? 1 : type === CardType.CEO ? 2 : 3;
}
const effectCards = computed(() => props.tableau
  .filter((card) => {
    const known = getCard(card.name);
    return known !== undefined && (ALWAYS.includes(known.type) || known.hasAction || hasEffect(card.name));
  })
  .map((card, index) => ({card, index}))
  .sort((a, b) => rank(a.card) - rank(b.card) || a.index - b.index)
  .map(({card}) => card));

const usableCards = computed(() => effectCards.value.filter((card) => props.usable?.has(card.name)));
/** In the window: the clicked card first, then the ones with an action to use, then the rest. */
const windowCards = computed(() => effectCards.value
  .map((card, index) => ({card, index, order: card.name === focused.value ? 0 : props.usable?.has(card.name) ? 1 : 2}))
  .sort((a, b) => a.order - b.order || a.index - b.index)
  .map(({card}) => card));
</script>

<style lang="less">
// Same tile as "Played Cards" (height, frame, title), between it and the hand.
.mission-effects {
  position: relative;
  display: grid;
  height: calc(352px * var(--mission-card-scale, 0.6));
  grid-template-rows: auto minmax(0, 1fr);
  gap: 6px;
  padding: 8px;
  border: 1px solid #6f8c98;
  border-radius: 10px;
  background: linear-gradient(#18293a, #0b141c);
  pointer-events: auto;
}

.mission-effects__title {
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  color: #eef6f8;
  font-size: 0.72rem;
  font-weight: 800;
  text-align: center;
  text-transform: uppercase;
}

.mission-effects__list {
  display: grid;
  grid-template-columns: repeat(2, 72px);
  align-content: start;
  gap: 6px;
  overflow-y: auto;
  overscroll-behavior: contain;
  // A visible scrollbar and whole rows per wheel step: easy to scroll.
  padding-right: 4px;
  scroll-snap-type: y mandatory;
  scrollbar-width: thin;
  scrollbar-color: #8fb3c0 #0b141c;

  > * {
    scroll-snap-align: start;
  }
}

.mission-effects__card {
  position: relative;
  width: 72px;
  height: 50px;
  overflow: hidden;
  padding: 0;
  border: 1px solid #6f8c98;
  border-radius: 6px;
  background: #0b141c;
  cursor: help;

  &--usable {
    border-color: #3c9be6;
    box-shadow: 0 0 10px #3c9be6aa;
    cursor: pointer;
  }

  .card-container {
    zoom: 0.3;
    margin: 0 !important;
  }

  &:hover,
  &:focus-visible {
    outline: none;
    border-color: #b4ffeb;
  }

  &--lit {
    border-color: #e2c27f;
    box-shadow: 0 0 12px #e2c27f;
    animation: mission-effects-lit 0.6s ease-in-out 4 alternate;
  }
}

@keyframes mission-effects-lit {
  to { box-shadow: 0 0 22px #ffe9bd; }
}

.mission-effects__preview {
  position: absolute;
  z-index: 30;
  bottom: calc(100% + 10px);
  left: 0;
  pointer-events: none;

  .card-container {
    zoom: 1.15;
    margin: 0 !important;
    box-shadow: 0 16px 40px #000c;
  }
}

.mission-effects__hint {
  display: block;
  margin-top: 8px;
  padding: 6px 10px;
  border: 1px solid #3c9be6;
  border-radius: 8px;
  background: #0b141cf0;
  color: #cfe8ff;
  font-size: 0.8rem;
  font-weight: 800;
  text-align: center;
  text-transform: uppercase;
}

.mission-effects__card {
  cursor: pointer;
}

// The window with the cards of the effects bar.
.mission-effects-window {
  width: min(1200px, calc(100vw - 32px));
  max-width: none;
  max-height: min(88dvh, 980px);
  padding: 0;
  overflow: hidden;
  border: 1px solid #e2c27f99;
  border-radius: 14px;
  background: linear-gradient(#152330f5, #0b131bf5);
  box-shadow: 0 24px 60px #000d;
  color: #eef6f8;

  &[open] {
    display: flex;
    flex-direction: column;
  }

  &::backdrop {
    background: #03070cb3;
    backdrop-filter: blur(4px);
  }

  header {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 18px;
    border-bottom: 1px solid #ffffff1f;

    h2 {
      margin: 0;
      padding: 0;
      color: #f6e2b8;
      font-size: 1.1rem;
      filter: none;
      text-transform: uppercase;
    }
  }
}

.mission-effects-window__count {
  padding: 2px 10px;
  border: 1px solid #3c9be6;
  border-radius: 999px;
  background: #0f2a40;
  color: #cfe8ff;
  font-size: 0.85rem;
  font-weight: 800;
}

.mission-effects-window__close {
  display: grid;
  width: 34px;
  height: 34px;
  margin-left: auto;
  place-items: center;
  border: 1px solid #6f8c98;
  border-radius: 8px;
  background: #0b141c;
  color: #eef6f8;
  font-size: 1.4rem;
  cursor: pointer;
}

.mission-effects-window__cards {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: flex-start;
  gap: 16px;
  overflow-y: auto;
  padding: 18px;
  scrollbar-width: thin;
}

.mission-effects-window__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;

  .card-container {
    margin: 0 !important;
    zoom: 0.85;
  }

  &--usable .card-container {
    box-shadow: 0 0 0 3px #3c9be6, 0 0 18px #3c9be699;
  }

  &--focused .card-container {
    box-shadow: 0 0 0 3px #e2c27f, 0 0 18px #e2c27f99;
  }
}

.mission-effects-window__use {
  padding: 8px 18px;
  border: 1px solid #3c9be6;
  border-radius: 9px;
  background: linear-gradient(#1d4f7a, #123552);
  color: #fff;
  font: inherit;
  font-weight: 800;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    border-color: #b4ffeb;
  }
}
</style>
