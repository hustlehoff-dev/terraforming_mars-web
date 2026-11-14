<template>
  <div v-if="secondsLeft !== undefined" class="nofloat mission-draft-clock" :class="{'mission-draft-clock--warn': secondsLeft <= 10}" role="timer" aria-live="polite">
    <span>{{ $t(label ?? 'Time to pick a card') }}</span>
    <b>{{ secondsLeft }}s</b>
  </div>
</template>

<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref, watch} from 'vue';
import {SoundManager} from '@/client/utils/SoundManager';

/*
 * Draft time limit, shown to a player who has not picked yet: another player already picked,
 * and when this reaches zero the game keeps the first card for this player.
 */
const props = defineProps<{deadline?: number, label?: string}>();

const now = ref(Date.now());
const timer = window.setInterval(() => {
  now.value = Date.now();
}, 250);
onBeforeUnmount(() => window.clearInterval(timer));
const secondsLeft = computed(() => props.deadline === undefined ? undefined : Math.max(0, Math.ceil((props.deadline - now.value) / 1000)));

onMounted(() => {
  SoundManager.clockStarted();
  navigator.vibrate?.([120, 80, 120]);
});
watch(secondsLeft, (left, before) => {
  if (left !== undefined && left !== before && left > 0 && left <= 5) {
    SoundManager.clockTick();
  }
});
</script>

<style lang="less">
.mission-draft-clock {
  display: flex !important;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: fit-content;
  margin: 0 auto 10px;
  padding: 6px 16px;
  border: 1px solid #e2c27f;
  border-radius: 12px;
  background: #0b141cf0;
  color: #eef6f8;
  font-weight: 700;

  b {
    min-width: 52px;
    font-size: 1.5rem;
    font-variant-numeric: tabular-nums;
    text-align: center;
  }

  &--warn {
    border-color: #ff7a5c;
    box-shadow: 0 0 14px #ff7a5c88;
    animation: mission-draft-clock-pulse 1s ease-in-out infinite;

    b {
      color: #ffd2c4;
    }
  }
}

@keyframes mission-draft-clock-pulse {
  50% {
    box-shadow: 0 0 2px #ff7a5c44;
  }
}
</style>
