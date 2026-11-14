<template>
  <Teleport to="body">
    <!-- A dialog so it opens above other game windows (e.g. Played Cards). Closed by a click anywhere or Escape. -->
    <dialog v-if="card" ref="dialog" class="mission-card-zoom" :aria-label="$t(card.name)"
      @cancel.prevent="closeCardZoom()" @click="closeCardZoom()">
      <div class="mission-card-zoom__card">
        <Card :key="card.name" :card="card" autoTall />
      </div>
      <p class="mission-card-zoom__hint" v-i18n>Click anywhere to close</p>
    </dialog>
  </Teleport>
</template>

<script setup lang="ts">
import {computed, nextTick, ref, watch} from 'vue';
import Card from '@/client/components/card/Card.vue';
import {closeCardZoom, zoomedCard} from './cardZoom';

const card = computed(() => zoomedCard.value);
const dialog = ref<HTMLDialogElement>();

watch(card, async (shown) => {
  if (shown === undefined) {
    return;
  }
  await nextTick();
  const element = dialog.value;
  if (element && !element.open) {
    try {
      element.showModal();
    } catch {
      element.setAttribute('open', '');
    }
  }
});
</script>

<style lang="less">
dialog.mission-card-zoom {
  position: fixed;
  inset: 0;
  display: grid;
  width: 100vw;
  max-width: none;
  height: 100dvh;
  max-height: none;
  margin: 0;
  padding: 16px;
  place-content: center;
  justify-items: center;
  gap: 12px;
  overflow: auto;
  border: 0;
  background: #02060acc;
  cursor: zoom-out;

  &::backdrop {
    background: transparent;
  }
}

.mission-card-zoom__card {
  filter: drop-shadow(0 20px 40px #000) drop-shadow(0 0 22px #e2c27f55);

  > .card-container {
    margin: 0;
    zoom: 1.3;

    @media (min-height: 700px) {
      zoom: 1.7;
    }

    @media (min-height: 860px) {
      zoom: 2.1;
    }

    @media (min-height: 1100px) {
      zoom: 2.6;
    }

    @media (max-width: 560px) {
      zoom: 1.4;
    }
  }
}

.mission-card-zoom__hint {
  margin: 0;
  color: #cfe0e6;
  font-size: 0.85rem;
  text-shadow: 0 1px 3px #000;
}

@media (prefers-reduced-motion: no-preference) {
  .mission-card-zoom__card {
    animation: mission-card-zoom-in 180ms ease-out both;
  }

  @keyframes mission-card-zoom-in {
    from { opacity: 0; transform: scale(0.85); }
    to { opacity: 1; transform: none; }
  }
}
</style>
