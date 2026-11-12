<template>
  <TransitionGroup
    v-if="cards.length"
    name="mission-draw"
    tag="div"
    class="mission-hand"
    role="group"
    :aria-label="$t('Cards In Hand')"
    @scroll.passive="reposition"
    @keydown.esc.stop="close">
    <div v-for="(card, index) in cards" :key="card.name" class="mission-hand__slot" :style="fanStyle(index)">
      <div
        class="mission-hand__face"
        :class="{'mission-hand__face--raised': raised?.name === card.name, 'mission-hand__face--pinned': raised?.name === card.name && raised.source === 'pin'}"
        :style="raised?.name === card.name ? raised.style : undefined"
        :id="handId + '-' + index"
        aria-hidden="true"
        @pointerdown.prevent
        @click.stop="close">
        <Card :card="card" :autoTall="raised?.name === card.name" :class="{'mission-card-available': playableCards?.has(card.name)}" inert />
      </div>
      <button
        type="button"
        class="mission-hand__hit"
        :aria-label="playableCards?.has(card.name) ? $t(card.name) + ' · ' + $t('Playable now') : $t(card.name)"
        :aria-describedby="handId + '-' + index"
        :aria-expanded="raised?.name === card.name"
        @pointerenter="hover(card.name, $event)"
        @pointerleave="leave(card.name, 'hover')"
        @focus="focusCard(card.name, $event)"
        @blur="blurCard(card.name)"
        @click="pin(card.name, $event)"></button>
    </div>
  </TransitionGroup>
</template>

<script setup lang="ts">
import {CSSProperties, nextTick, onBeforeUnmount, onMounted, shallowRef, useId, watch} from 'vue';
import Card from '@/client/components/card/Card.vue';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {SoundManager} from '@/client/utils/SoundManager';

const props = defineProps<{cards: ReadonlyArray<CardModel>, playableCards?: ReadonlySet<CardName>}>();
const handId = useId();
type Source = 'hover' | 'focus' | 'pin';
type RaisedCard = {name: CardName, anchor: HTMLElement, source: Source, style: CSSProperties};
const raised = shallowRef<RaisedCard>();

function fanStyle(index: number): CSSProperties {
  const middle = (props.cards.length - 1) / 2;
  const offset = (index - middle) / Math.max(1, middle);
  return {'--card-tilt': `${offset * 5}deg`, '--card-drop': `${Math.abs(offset) * 6}px`};
}

function position(anchor: HTMLElement): CSSProperties {
  const slot = anchor.getBoundingClientRect();
  const face = anchor.parentElement?.querySelector<HTMLElement>('.mission-hand__face');
  const width = face?.offsetWidth || 240;
  const height = face?.offsetHeight || 325;
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
  const scale = Math.max(0.01, Math.min(1, (viewportWidth - 24) / width, (slot.bottom - 24) / height));
  const left = Math.max(12, Math.min(slot.left + (slot.width - width * scale) / 2, viewportWidth - width * scale - 12));
  const top = Math.max(12, slot.bottom - height * scale - 16);
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
  if (event.pointerType === 'mouse' && raised.value?.name !== name) {
    lift(name, event, 'hover');
  }
}

function focusCard(name: CardName, event: FocusEvent) {
  if (event.currentTarget instanceof HTMLElement && event.currentTarget.matches(':focus-visible')) {
    lift(name, event, 'focus');
  }
}

function pin(name: CardName, event: MouseEvent) {
  if (raised.value?.name === name && raised.value.source === 'pin') {
    close();
  } else {
    lift(name, event, 'pin');
    SoundManager.mission('card');
  }
}

function leave(name: CardName, source: Source) {
  if (raised.value?.name === name && raised.value.source === source) {
    close();
  }
}

function blurCard(name: CardName) {
  leave(name, 'focus');
  leave(name, 'pin');
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

onMounted(() => {
  document.addEventListener('pointerdown', closeOutside);
  window.addEventListener('resize', reposition);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeOutside);
  window.removeEventListener('resize', reposition);
});
</script>
