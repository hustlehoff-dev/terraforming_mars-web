<template>
  <!-- Undoing a turn: whoever asked waits, every other player agrees or refuses. -->
  <Teleport to="body">
    <div v-if="request || error" class="undo-turn" role="status">
      <template v-if="request">
        <p class="undo-turn__text">
          <span aria-hidden="true">⟲</span>
          {{ requestText }}
        </p>
        <p class="undo-turn__votes">
          <span v-for="player in viewModel.players" :key="player.color" class="undo-turn__vote"
            :class="{'undo-turn__vote--yes': request.votes.includes(player.color)}">
            <span class="undo-turn__swatch" :class="'player_bg_color_' + player.color" aria-hidden="true"></span>
            {{ player.name }} {{ request.votes.includes(player.color) ? '✓' : '…' }}
          </span>
        </p>
        <span class="undo-turn__buttons">
          <template v-if="iMustVote">
            <button type="button" class="undo-turn__button undo-turn__button--yes" :disabled="busy" @click="send('yes')" v-i18n>Agree</button>
            <button type="button" class="undo-turn__button" :disabled="busy" @click="send('no')" v-i18n>Refuse</button>
          </template>
          <button v-else-if="request.by === viewModel.color" type="button" class="undo-turn__button" :disabled="busy" @click="send('cancel')" v-i18n>Cancel</button>
        </span>
      </template>
      <p v-else class="undo-turn__error">{{ error }}</p>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref} from 'vue';
import {paths} from '@/common/app/paths';
import {Color} from '@/common/Color';
import {ViewModel} from '@/common/models/PlayerModel';
import {isPlayerId} from '@/common/Types';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';

type Request = {by: Color, turnOf: Color, generation: number, votes: Array<Color>, waitingFor: Array<Color>};

/*
 * A player can ask to undo the last turn (the button is in the right column and calls `ask`).
 * Every other player sees the request here and agrees or refuses; when all agreed, the game goes
 * back to the start of that turn and every page reloads it.
 */
const props = defineProps<{viewModel: ViewModel}>();
const request = ref<Request>();
const error = ref<string>();
const busy = ref(false);
let timer: number | undefined;
let errorTimer: number | undefined;

function nameOf(color: Color): string {
  return props.viewModel.players.find((player) => player.color === color)?.name ?? color;
}

const requestText = computed(() => {
  const value = request.value;
  if (value === undefined) {
    return '';
  }
  return translateTextWithParams('${0} asks to undo the turn of ${1} (generation ${2})',
    [nameOf(value.by), nameOf(value.turnOf), String(value.generation)]);
});
const iMustVote = computed(() => request.value?.waitingFor.includes(props.viewModel.color as Color) === true && isPlayerId(props.viewModel.id));

function showError(message: string) {
  error.value = message;
  window.clearTimeout(errorTimer);
  errorTimer = window.setTimeout(() => {
    error.value = undefined;
  }, 5000);
}

async function call(action?: 'request' | 'yes' | 'no' | 'cancel'): Promise<void> {
  const query = new URLSearchParams({id: props.viewModel.id});
  if (action !== undefined) {
    query.set('do', action);
  }
  const response = await fetch(`${paths.API_UNDO_TURN}?${query}`);
  if (!response.ok) {
    if (action !== undefined) {
      const text = (await response.text()).replace(/^Bad request:\s*/, '');
      showError(translateText(text || 'The turn cannot be undone'));
    }
    return;
  }
  const status: {request?: Request, undoCount: number} = await response.json();
  request.value = status.request;
}

async function send(action: 'request' | 'yes' | 'no' | 'cancel') {
  busy.value = true;
  try {
    await call(action);
  } catch {
    showError(translateText('The turn cannot be undone'));
  } finally {
    busy.value = false;
  }
}

/** The "Undo turn" button of the right column. */
function ask() {
  void send('request');
}

onMounted(() => {
  void call().catch(() => {});
  timer = window.setInterval(() => void call().catch(() => {}), 3000);
});
onBeforeUnmount(() => {
  window.clearInterval(timer);
  window.clearTimeout(errorTimer);
});

defineExpose({ask});
</script>

<style scoped lang="less">
.undo-turn {
  position: fixed;
  z-index: 60;
  top: 14px;
  left: 50%;
  display: flex;
  max-width: min(760px, calc(100vw - 32px));
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px 16px;
  padding: 12px 18px;
  border: 1px solid #e2c27f;
  border-radius: 12px;
  background: linear-gradient(#1b2a36f5, #0b131bf5);
  box-shadow: 0 10px 30px #000c;
  color: #eef6f8;
  transform: translateX(-50%);
}

.undo-turn__text {
  margin: 0;
  font-weight: 700;

  span {
    margin-right: 6px;
    color: #ffe2a8;
  }
}

.undo-turn__votes {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
}

.undo-turn__vote {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 9px;
  border: 1px solid #ffffff33;
  border-radius: 999px;
  color: #9fb1b9;
  font-size: 0.85rem;

  &--yes {
    border-color: #6be39b;
    color: #b8f5c8;
  }
}

.undo-turn__swatch {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.undo-turn__buttons {
  display: inline-flex;
  gap: 8px;
}

.undo-turn__button {
  min-height: 36px;
  padding: 0 16px;
  border: 1px solid #6f8c98;
  border-radius: 8px;
  background: #142630;
  color: #eef6f8;
  font: inherit;
  font-weight: 800;
  text-transform: uppercase;
  cursor: pointer;

  &--yes {
    border-color: #6be39b;
    background: #1f4a33;
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
}

.undo-turn__error {
  margin: 0;
  color: #ffb4a6;
}
</style>
