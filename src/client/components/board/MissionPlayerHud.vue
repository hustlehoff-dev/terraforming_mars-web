<template>
  <div class="mission-player-hud">
    <div class="mission-player-hud__corporations">
      <button
        v-for="card in corporations"
        :key="card.name"
        type="button"
        :class="{'mission-card-available': actionCards.has(card.name)}"
        aria-haspopup="dialog"
        @click="openCorporation(card)">
        <span class="mission-player-hud__logo" aria-hidden="true" inert><CardCorporationLogo :title="card.name" /></span>
        <strong>{{ $t(card.name) }}</strong>
        <span v-if="actionCards.has(card.name)" class="mission-card-status" v-i18n>Action available</span>
      </button>
    </div>
    <ul class="mission-player-hud__stocks" :aria-label="$t('Resources')">
      <li v-for="resource in ALL_RESOURCES" :key="resource">
        <ResourceIcon :resource="resource" />
        <strong :key="player[resource]" class="mission-status__value">{{ player[resource] }}</strong>
      </li>
    </ul>
    <MissionHand :cards="cards" :playableCards="playableCards" @openActions="emit('openActions')" />
    <dialog ref="dialog" class="mission-player-hud__dialog" :aria-label="selected && $t(selected.name)" @close="selected = undefined">
      <form method="dialog"><button type="submit" autofocus v-i18n>Close</button></form>
      <Card v-if="selected" :card="selected" autoTall />
    </dialog>
  </div>
</template>

<script setup lang="ts">
import {computed, nextTick, onMounted, ref} from 'vue';
import dialogPolyfill from 'dialog-polyfill';
import {hasShowModal, showModal} from '@/client/components/HTMLDialogElementCompatibility';
import MissionHand from '@/client/components/board/MissionHand.vue';
import Card from '@/client/components/card/Card.vue';
import CardCorporationLogo from '@/client/components/card/CardCorporationLogo.vue';
import ResourceIcon from '@/client/components/common/ResourceIcon.vue';
import {getCardsByType} from '@/client/utils/CardUtils';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {CardModel} from '@/common/models/CardModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {ALL_RESOURCES} from '@/common/Resource';

const props = defineProps<{
  player: PublicPlayerModel;
  cards: ReadonlyArray<CardModel>;
  playableCards: ReadonlySet<CardName>;
  actionCards: ReadonlySet<CardName>;
}>();
const emit = defineEmits<{openActions: []}>();
const corporations = computed(() => getCardsByType(props.player.tableau, [CardType.CORPORATION]));
const dialog = ref<HTMLDialogElement>();
const selected = ref<CardModel>();

onMounted(() => {
  if (dialog.value && !hasShowModal(dialog.value)) {
    dialogPolyfill.registerDialog(dialog.value);
  }
});

async function openCorporation(card: CardModel) {
  selected.value = card;
  await nextTick();
  if (dialog.value) {
    showModal(dialog.value);
  }
}
</script>
