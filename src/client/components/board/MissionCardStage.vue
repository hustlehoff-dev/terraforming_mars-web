<template>
  <Teleport to="body">
    <div
      ref="root"
      class="mission-stage"
      :class="['mission-stage--skin-' + getPreferences().card_skin, {'mission-stage--playable': input !== undefined}]"
      role="group"
      tabindex="-1"
      :aria-label="$t(card.name)"
      :style="stageStyle"
      @keydown.esc.stop.prevent="emit('close')">
      <div ref="cardFrame" class="mission-stage__card" :class="{'mission-stage__card--entering': entering}" @click="emit('close')">
        <Card :card="shownCard" :art="isProject" autoTall :class="{'mission-card-available': input !== undefined}" />
      </div>
      <div class="mission-stage__controls">
        <p v-if="input && card.name === CardName.EQUATORIAL_MAGNETIZER && playerView.thisPlayer.energyProduction === 0" class="mission-stage__locked" v-i18n>
          You can play this card now. Its action needs at least 1 energy production.
        </p>
        <div v-if="useAction" class="mission-stage__use">
          <AppButton type="submit" :title="$t('Use action')" @click="emit('use')" />
        </div>
        <SelectProjectCardToPlay
          v-else-if="input !== undefined"
          :key="card.name"
          :playerView="playerView"
          :playerinput="input"
          :selectedCard="card.name"
          :autoSave="autoPlay"
          :onsave="(response) => emit('play', response)"
          showsave />
        <div v-else-if="isProject" class="mission-stage__locked" role="status">
          <strong v-i18n>You cannot play this card now</strong>
          <ul>
            <li v-for="blocker in blockers" :key="blocker.text">{{ translateTextWithParams(blocker.text, blocker.params) }}</li>
          </ul>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import {computed, CSSProperties, nextTick, onBeforeUnmount, onMounted, ref} from 'vue';
import Card from '@/client/components/card/Card.vue';
import SelectProjectCardToPlay from '@/client/components/SelectProjectCardToPlay.vue';
import AppButton from '@/client/components/common/AppButton.vue';
import {CardModel} from '@/common/models/CardModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {SelectProjectCardToPlayModel} from '@/common/models/PlayerInputModel';
import {InputResponse} from '@/common/inputs/InputResponse';
import {CardType} from '@/common/cards/CardType';
import {CardName} from '@/common/cards/CardName';
import {getCardOrThrow} from '@/client/cards/ClientCardManifest';
import {getPreferences} from '@/client/utils/PreferencesManager';
import {cardPlayBlockers} from '@/client/utils/CardPlayBlockers';
import {translateTextWithParams} from '@/client/directives/i18n';

/*
 * A card lifted out of the hand and held over the board, with its payment and play button
 * underneath. It is not a dialog: the board stays visible and clicking anywhere else, the card
 * itself or Escape puts the card back in the hand.
 */
const props = defineProps<{
  card: CardModel;
  input: SelectProjectCardToPlayModel | undefined;
  playerView: PlayerViewModel;
  origin?: DOMRect;
  autoPlay?: boolean;
  /** Shows a played card with a "Use action" button instead of payment controls. */
  useAction?: boolean;
}>();
const emit = defineEmits<{close: [], play: [response: InputResponse], use: []}>();
const root = ref<HTMLElement>();

const isProject = computed(() => [CardType.AUTOMATED, CardType.ACTIVE, CardType.EVENT].includes(getCardOrThrow(props.card.name).type));
// What stops the card from being played, shown right under it.
const blockers = computed(() => props.input === undefined && !props.useAction ? cardPlayBlockers(props.playerView, props.card) : []);
const shownCard = computed(() => props.input?.cards.find((card) => card.name === props.card.name) ?? props.card);

const cardFrame = ref<HTMLElement>();
const entering = ref(false);
const scale = ref(1);
const stageStyle = computed<CSSProperties>(() => ({'--stage-scale': scale.value}));

// Fit the whole card between the top bar and the hand, leaving room for the play controls.
function fit() {
  const frame = cardFrame.value;
  const stage = root.value;
  if (!frame || !stage) {
    return;
  }
  const natural = frame.getBoundingClientRect();
  const controls = stage.querySelector('.mission-stage__controls')?.getBoundingClientRect().height ?? 0;
  const padding = getComputedStyle(stage);
  const available = stage.clientHeight - parseFloat(padding.paddingTop) - parseFloat(padding.paddingBottom) - controls - 16;
  const width = stage.clientWidth - 32;
  scale.value = Math.max(0.55, Math.min(1.5, available / Math.max(1, natural.height / scale.value), width / Math.max(1, natural.width / scale.value)));
}

// Fly the card from where it was in the hand to its place over the board.
function flyFromOrigin() {
  const frame = cardFrame.value;
  const origin = props.origin;
  if (!frame || origin === undefined) {
    return;
  }
  const target = frame.getBoundingClientRect();
  frame.style.setProperty('--from-x', `${origin.left + origin.width / 2 - (target.left + target.width / 2)}px`);
  frame.style.setProperty('--from-y', `${origin.top + origin.height / 2 - (target.top + target.height / 2)}px`);
  frame.style.setProperty('--from-scale', String(origin.width / Math.max(1, target.width)));
  entering.value = true;
}

function closeOutside(event: PointerEvent) {
  const target = event.target;
  if (!(target instanceof Element) || root.value?.contains(target) || target.closest('.mission-hand__hit')) {
    return;
  }
  emit('close');
}

onMounted(async () => {
  document.addEventListener('pointerdown', closeOutside, true);
  await nextTick();
  fit();
  await nextTick();
  flyFromOrigin();
  window.addEventListener('resize', fit);
  const play = root.value?.querySelector<HTMLElement>('.payments_save button, .mission-stage__use button');
  (play ?? root.value)?.focus({preventScroll: true});
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', closeOutside, true);
  window.removeEventListener('resize', fit);
});
</script>
