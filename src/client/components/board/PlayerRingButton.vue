<template>
  <button type="button" class="player-ring-button" :disabled="state === 'sending' || state === 'sent'"
    :title="label" :aria-label="label" @click="ring">
    <span aria-hidden="true">{{ state === 'sent' ? '✓' : state === 'error' ? '!' : '🔔' }}</span>
  </button>
</template>

<script setup lang="ts">
import {computed, onBeforeUnmount, ref} from 'vue';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {paths} from '@/common/app/paths';
import {PLAYER_RING_COOLDOWN_MS} from '@/common/models/ChatMessageModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {PlayerId} from '@/common/Types';

const props = defineProps<{sender: PlayerId, target: Pick<PublicPlayerModel, 'name' | 'color'>}>();
const state = ref<'sending' | 'sent' | 'error'>();
let resetTimer: number | undefined;
let request: AbortController | undefined;

const label = computed(() => {
  if (state.value === 'sent') {
    return translateText('Ring sent');
  }
  if (state.value === 'error') {
    return translateText('Could not ring the player. Try again in a moment.');
  }
  return translateTextWithParams('Ring ${0}', [props.target.name]);
});

async function ring() {
  window.clearTimeout(resetTimer);
  const current = new AbortController();
  request = current;
  state.value = 'sending';
  try {
    const query = new URLSearchParams({id: props.sender});
    const response = await fetch(`${paths.API_CHAT}?${query}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ring: props.target.color}),
      signal: current.signal,
    });
    state.value = response.ok ? 'sent' : 'error';
  } catch {
    if (current.signal.aborted) {
      return;
    }
    state.value = 'error';
  }
  resetTimer = window.setTimeout(() => {
    state.value = undefined;
  }, state.value === 'sent' ? PLAYER_RING_COOLDOWN_MS : 2500);
}

onBeforeUnmount(() => {
  request?.abort();
  window.clearTimeout(resetTimer);
});
</script>

<style scoped lang="less">
.player-ring-button {
  display: grid;
  min-width: 36px;
  min-height: 36px;
  flex: none;
  place-items: center;
  padding: 0;
  border: 1px solid #59707c;
  border-radius: 8px;
  background: #142630;
  color: #ffe2a8;
  font-size: 1rem;
  cursor: pointer;

  &:hover:not(:disabled), &:focus-visible {
    border-color: #e2c27f;
    background: #243a46;
  }

  &:disabled {
    cursor: default;
  }
}
</style>
