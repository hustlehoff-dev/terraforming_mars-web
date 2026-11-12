<template>
  <div class="cardbox">
    <div v-for="(card, index) in cards" :key="card.name" class="stacked-card" :class="{'cards-stack':(index > 0),'cards-stack-first':(index === 0) }">
      <Card :card="card" :class="{'mission-card-available': actionCards?.has(card.name)}" />
      <span v-if="actionCards?.has(card.name)" class="mission-card-status" v-i18n>Action available</span>
      <button
        type="button"
        class="stacked-card__open"
        :aria-label="`${$t('View card')} · ${$t(card.name)}`"
        aria-haspopup="dialog"
        @click="openCard(card)">
        <span v-i18n>View card</span>
      </button>
    </div>
    <dialog ref="dialog" class="stacked-card__dialog" :aria-label="selectedCard && $t(selectedCard.name)" @close="selectedCard = undefined">
      <form method="dialog">
        <button type="submit" autofocus v-i18n>Close</button>
      </form>
      <Card v-if="selectedCard" :card="selectedCard" autoTall />
    </dialog>
  </div>
</template>

<script setup lang="ts">
import {nextTick, onMounted, ref} from 'vue';
import dialogPolyfill from 'dialog-polyfill';
import Card from '@/client/components/card/Card.vue';
import {hasShowModal, showModal} from '@/client/components/HTMLDialogElementCompatibility';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';

defineProps<{cards: ReadonlyArray<CardModel>, actionCards?: ReadonlySet<CardName>}>();
const selectedCard = ref<CardModel>();
const dialog = ref<HTMLDialogElement>();

onMounted(() => {
  const element = dialog.value;
  if (element && !hasShowModal(element)) {
    dialogPolyfill.registerDialog(element);
  }
});

async function openCard(card: CardModel) {
  selectedCard.value = card;
  await nextTick();
  if (dialog.value) {
    showModal(dialog.value);
  }
}
</script>

<style scoped lang="less">
.stacked-card {
  position: relative;

  &:focus-within {
    z-index: 3;
  }
}

.stacked-card__open {
  position: absolute;
  inset-block-start: 4px;
  inset-inline-end: 2px;
  padding: 0.15rem 0.26rem;
  border: 1px solid #9fb0ba;
  border-radius: 0.15rem;
  background: #111a22;
  color: #f2eee6;
  font-size: 0.54rem;

  &:focus-visible {
    outline: 2px solid #b8e1ea;
  }
}

.stacked-card__dialog {
  max-width: calc(100vw - 1rem);
  max-height: calc(100dvh - 1rem);
  overflow: auto;
  padding: 0.5rem;
  border: 1px solid #9fb0ba;
  background: #111a22;
  color: #f2eee6;
  overscroll-behavior: contain;

  &::backdrop {
    background: #05090cbb;
  }

  form {
    text-align: end;
  }

  :deep(.card-container) {
    margin-inline-end: 0;
  }
}
</style>

