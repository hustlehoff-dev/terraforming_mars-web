<template>
  <Teleport to="body">
    <dialog v-if="paused" ref="dialog" class="mission-paused" role="alertdialog" aria-live="assertive" :aria-label="$t('Game paused')" @cancel.prevent>
      <div class="mission-paused__box">
        <span class="mission-paused__icon" aria-hidden="true">⏸</span>
        <strong v-i18n>Game paused</strong>
        <p>{{ $t('Paused by') }} <span class="mission-paused__who" :class="'player_bg_color_' + paused.by">{{ pausedBy }}</span></p>
        <p class="mission-paused__note" v-i18n>Moves and turn clocks are stopped until someone resumes.</p>
        <button type="button" class="mission-paused__resume" :disabled="busy" @click="emit('resume')" v-i18n>Resume the game</button>
      </div>
    </dialog>
  </Teleport>
</template>

<script setup lang="ts">
import {computed, nextTick, onBeforeUnmount, ref, watch} from 'vue';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';

/* Covers the game while it is paused: who paused it, and a button to resume. */
const props = defineProps<{paused?: {by: Color, at: number}, players: ReadonlyArray<PublicPlayerModel>, busy?: boolean}>();
const emit = defineEmits<{resume: []}>();
const pausedBy = computed(() => props.players.find((player) => player.color === props.paused?.by)?.name ?? props.paused?.by);
const dialog = ref<HTMLDialogElement>();

// A native modal can appear above a draft dialog; a fixed overlay cannot enter its top layer.
watch(() => props.paused, async (paused) => {
  await nextTick();
  if (paused !== props.paused) {
    return;
  }
  if (paused && dialog.value?.isConnected && !dialog.value.open) {
    dialog.value.showModal();
  } else if (!paused) {
    dialog.value?.close();
  }
}, {immediate: true, flush: 'post'});
onBeforeUnmount(() => dialog.value?.close());
</script>

<style lang="less">
.mission-paused {
  position: fixed;
  z-index: 200;
  inset: 0;
  box-sizing: border-box;
  display: grid;
  width: 100vw;
  max-width: none;
  height: 100dvh;
  max-height: none;
  margin: 0;
  padding: 16px;
  overflow: auto;
  border: 0;
  place-items: center;
  background: #03070cc4;
  backdrop-filter: blur(3px);

  &:not([open]) { display: none; }
  &::backdrop { background: transparent; }
}

.mission-paused__box {
  display: grid;
  box-sizing: border-box;
  width: min(440px, 100%);
  justify-items: center;
  gap: 8px;
  padding: clamp(18px, 5vw, 28px) clamp(16px, 5vw, 40px);
  border: 1px solid #e2c27f;
  border-radius: 16px;
  background: linear-gradient(#152330f7, #0b131bf7);
  box-shadow: 0 0 30px #e2c27f44, 0 24px 60px #000d;
  color: #eef6f8;
  text-align: center;

  strong {
    color: #fff3c4;
    font-size: 1.6rem;
  }

  p {
    margin: 0;
  }
}

.mission-paused__icon {
  font-size: 2.6rem;
}

.mission-paused__who {
  padding: 2px 8px;
  border-radius: 6px;
  color: #fff;
  font-weight: 800;
  text-shadow: 0 1px 2px #000;
}

.mission-paused__note {
  color: #9fb8c2;
  font-size: 0.85rem;
}

.mission-paused__resume {
  margin-top: 8px;
  padding: 12px 26px;
  border: 1px solid #e2c27f;
  border-radius: 10px;
  background: linear-gradient(#5a4116, #2f220c);
  color: #ffe9bd;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: wait;
  }
}
</style>
