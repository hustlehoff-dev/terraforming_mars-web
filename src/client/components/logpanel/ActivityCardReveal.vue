<template>
  <Teleport to="body">
    <!-- Same dialog, layout and styles as choosing cards dealt from the project deck (WaitingFor + SelectCard). -->
    <dialog ref="dialog" class="wf-root deck-choice-dialog activity-card-reveal" :aria-label="title"
      @cancel.prevent="emit('close')" @click.self="emit('close')">
      <div class="wf-component wf-component--select-card deck-deal">
        <template v-for="(group, groupIndex) in groups" :key="groupIndex">
          <div class="nofloat wf-component-title">{{ group.title }}</div>
          <div v-if="groupIndex === 0" class="deck-deal__origin" aria-hidden="true"></div>
          <div v-for="(name, index) in group.cards" :key="groupIndex + ':' + index" class="cardbox"
            :style="{'--deal-delay': Math.min(index, 10) * 65 + 'ms'}">
            <Card v-if="getCard(name)" :card="{name}" style="cursor: zoom-in" :title="$t('Click to view up close')" @click="zoomCard({name} as CardModel)" />
            <strong v-else>{{ $t(name) }}</strong>
          </div>
        </template>
        <div class="nofloat">
          <AppButton type="submit" :title="$t('OK')" @click="emit('close')" />
        </div>
      </div>
    </dialog>
  </Teleport>
</template>

<script setup lang="ts">
import Card from '@/client/components/card/Card.vue';
import {zoomCard} from '@/client/components/board/cardZoom';
import {CardModel} from '@/common/models/CardModel';
import AppButton from '@/client/components/common/AppButton.vue';
import {getCard} from '@/client/cards/ClientCardManifest';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {computed, onBeforeUnmount, onMounted, ref} from 'vue';
import {DeckActivity, deckLabels} from '@/common/models/GameActivityModel';
import {Color} from '@/common/Color';
import {revealOpen} from './revealState';

/*
 * Cards drawn or revealed from the project deck, shown in the centre of the screen in the same
 * window as a deck choice. Closed with OK, Escape or a click outside the window.
 */
const props = defineProps<{batches: ReadonlyArray<DeckActivity>, playerName?: (color: Color | undefined) => string | undefined}>();
const emit = defineEmits<{close: []}>();
const dialog = ref<HTMLDialogElement>();

/** Batches of the same kind for the same player in a row (e.g. a card from the card and one from the ocean bonus) form one group. */
const merged = computed(() => {
  const result: Array<DeckActivity> = [];
  for (const batch of props.batches) {
    const last = result.at(-1);
    if (last !== undefined && last.kind === batch.kind && last.player === batch.player) {
      result[result.length - 1] = {...last, cards: [...last.cards, ...batch.cards]};
    } else {
      result.push(batch);
    }
  }
  return result;
});

const groups = computed(() => merged.value.map((batch) => {
  const who = props.playerName?.(batch.player);
  let title: string;
  if (batch.kind === 'drawn' && who === undefined) {
    title = batch.cards.length === 1 ? translateText('You drew a card') : translateTextWithParams('You drew ${0} cards', [String(batch.cards.length)]);
  } else {
    title = [who, translateText(deckLabels[batch.kind])].filter(Boolean).join(' ');
  }
  return {title, cards: batch.cards};
}));
const title = computed(() => groups.value.map((group) => group.title).join(', '));

onMounted(() => {
  revealOpen.value = true;
  const element = dialog.value;
  if (element && !element.open) {
    try {
      element.showModal();
    } catch {
      element.setAttribute('open', '');
    }
  }
});

onBeforeUnmount(() => {
  revealOpen.value = false;
  if (dialog.value?.open && typeof dialog.value.close === 'function') {
    dialog.value.close();
  }
});
</script>
