<template>
  <div class="mission-draft-wait" role="status" aria-live="polite">
    <p>
      {{ $t('Waiting for') }}
      <span v-for="player in waitingFor" :key="player.color" class="mission-draft-wait__player" :class="'player_bg_color_' + player.color">{{ player.name }}</span>
    </p>
    <span v-if="secondsLeft !== undefined" class="mission-draft-wait__clock" :class="{'mission-draft-wait__clock--warn': secondsLeft <= 5}">{{ secondsLeft }}s</span>
  </div>
</template>

<script setup lang="ts">
import {computed, onBeforeUnmount, ref} from 'vue';
import {PublicPlayerModel} from '@/common/models/PlayerModel';

/*
 * Shows who is still choosing and, with a draft time limit, how long they have left.
 */
const props = defineProps<{players: ReadonlyArray<PublicPlayerModel>, deadline?: number}>();

const waitingFor = computed(() => props.players.filter((player) => player.needsToDraft === true));
const now = ref(Date.now());
const timer = window.setInterval(() => {
  now.value = Date.now();
}, 250);
onBeforeUnmount(() => window.clearInterval(timer));
const secondsLeft = computed(() => props.deadline === undefined ? undefined : Math.max(0, Math.ceil((props.deadline - now.value) / 1000)));
</script>

<style lang="less">
.mission-draft-wait {
  position: fixed;
  z-index: 30;
  top: 50%;
  left: 50%;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 26px;
  border: 1px solid #e2c27f;
  border-radius: 14px;
  background: linear-gradient(#152330f2, #0b131bf2);
  max-width: calc(100vw - 32px);
  color: #eef6f8;
  transform: translate(-50%, -50%);

  p {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin: 0;
    color: #cfe0e6;
  }
}

.mission-draft-wait__player {
  padding: 2px 8px;
  border-radius: 6px;
  color: #fff;
  font-weight: 800;
  text-shadow: 0 1px 2px #000;
}

.mission-draft-wait__clock {
  min-width: 64px;
  padding: 8px 12px;
  border: 1px solid #6f8c98;
  border-radius: 10px;
  background: #0b141c;
  font-size: 1.6rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  text-align: center;

  &--warn {
    border-color: #ff7a5c;
    color: #ffd2c4;
  }
}
</style>
