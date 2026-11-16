<template>
  <div class="mission-turn" :class="{'mission-turn--armed': armed}">
    <ul v-if="armed && (usable.length || cardActions.length)" class="mission-turn__menu" :aria-label="$t('Available actions')">
      <li v-for="card in cardActions" :key="'card:' + card.name">
        <button type="button" class="mission-turn__item mission-turn__item--card" @click="armed = false; emit('cardAction', card)">
          <span class="mission-turn__badge" aria-hidden="true">➜</span>
          <span>{{ $t(card.name) }}</span>
          <small class="mission-turn__kind" v-i18n>Card action</small>
        </button>
      </li>
      <li v-for="action in usable" :key="action.id">
        <button type="button" class="mission-turn__item" @click="choose(action)">
          <span v-if="action.effects" class="mission-turn__effects" aria-hidden="true">
            <span v-for="(effect, index) in action.effects" :key="index" class="mission-turn__effect" :class="{'mission-turn__effect--production': effect.production}">
              <small v-if="effect.text">{{ effect.text }}</small><img :src="effect.img" alt="">
            </span>
          </span>
          <ResourceIcon v-else-if="action.icon" :resource="action.icon" />
          <span>{{ $t(action.title ?? action.label) }}</span>
          <span v-if="action.cost !== undefined" class="mission-turn__cost">{{ action.cost }}</span>
        </button>
      </li>
    </ul>
    <span v-if="secondsLeft !== undefined" class="mission-turn__clock" :class="{'mission-turn__clock--warn': secondsLeft <= 20}" role="timer">
      <span class="mission-turn__clock-icon" aria-hidden="true">⏱</span>
      <span class="mission-turn__clock-label">{{ $t(secondsLeft <= 20 ? 'Auto pass in' : 'Your turn time') }}</span>
      <b>{{ clock }}</b>
    </span>
    <div v-if="active && actionsTaken !== undefined && noActionLimit" class="mission-turn__count" aria-live="polite">
      <span>{{ $t(soloGame ? 'No action limit' : 'Others passed: no action limit') }}</span>
    </div>
    <div v-else-if="active && actionsTaken !== undefined" class="mission-turn__count" :class="{'mission-turn__count--last': actionsTaken >= 1}" aria-live="polite">
      <span class="mission-turn__pips" aria-hidden="true">
        <i v-for="pip in 2" :key="pip" :class="{done: pip <= actionsTaken, now: pip === actionsTaken + 1}"></i>
      </span>
      <span>{{ actionCaption }}</span>
    </div>
    <span class="mission-turn__caption">{{ caption }}</span>
    <button type="button" class="mission-turn__button" :class="{'mission-turn__button--idle': !active, 'mission-turn__button--armed': armed}"
      :aria-label="caption" :disabled="!active" @click="press">
      <span aria-hidden="true">{{ armed ? '✓' : '➜' }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import {computed, onBeforeUnmount, ref, watch} from 'vue';
import ResourceIcon from '@/client/components/common/ResourceIcon.vue';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import type {MissionQuickAction} from './MissionQuickAction';
import {CardModel} from '@/common/models/CardModel';

/*
 * One big turn button in the bottom-right corner, like "next turn" in strategy games.
 * First click: shows the actions available now and arms the button (✓).
 * Second click on the same button: passes (or ends the turn), without any other confirmation.
 */
const props = defineProps<{
  actions: ReadonlyArray<MissionQuickAction>;
  /** Played cards whose action can be used now. */
  cardActions: ReadonlyArray<CardModel>;
  canPass: boolean;
  canEndTurn: boolean;
  /** True while it is this player's decision. */
  active: boolean;
  /** Changes on every new server request, closing the menu. */
  requestId?: number | string;
  /** End of this player's action turn (epoch ms) when the game has a turn time limit. */
  deadline?: number;
  /** Actions already taken in this turn (a turn has two). */
  actionsTaken?: number;
  /** Every other player has passed (or solo): actions go on until this player passes. */
  noActionLimit?: boolean;
  soloGame?: boolean;
}>();
const actionCaption = computed(() => (props.actionsTaken ?? 0) >= 1 ?
  translateText('Last action this turn') :
  translateTextWithParams('Action ${0} of ${1}', [String((props.actionsTaken ?? 0) + 1), '2']));
const emit = defineEmits<{select: [action: MissionQuickAction], cardAction: [card: CardModel], pass: [], endTurn: []}>();
const armed = ref(false);
const now = ref(Date.now());
const ticker = window.setInterval(() => {
  now.value = Date.now();
}, 500);
onBeforeUnmount(() => window.clearInterval(ticker));
const secondsLeft = computed(() => props.deadline === undefined || !props.active ? undefined : Math.max(0, Math.ceil((props.deadline - now.value) / 1000)));
const clock = computed(() => {
  const seconds = secondsLeft.value ?? 0;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
});

// Standard projects (Build colony too) have their own bar at the top: not repeated here.
const usable = computed(() => props.actions.filter((action) => !action.disabled && action.card === undefined));
const available = computed(() => usable.value.length + props.cardActions.length);
const caption = computed(() => {
  if (!props.active) {
    return translateText('Wait for your turn');
  }
  if (armed.value) {
    return props.canPass ? translateText('Click again to pass') : props.canEndTurn ? translateText('Click again to end turn') : translateText('Your turn');
  }
  if (available.value > 0) {
    return translateTextWithParams('Actions available: ${0}', [String(available.value)]);
  }
  if (props.canEndTurn) {
    return translateText('End Turn');
  }
  return props.canPass ? translateText('Pass') : translateText('Your turn');
});

watch(() => props.requestId, () => {
  armed.value = false;
});

function choose(action: MissionQuickAction) {
  armed.value = false;
  emit('select', action);
}

function press() {
  if (!armed.value) {
    armed.value = true;
    return;
  }
  armed.value = false;
  if (props.canPass) {
    emit('pass');
  } else if (props.canEndTurn) {
    emit('endTurn');
  }
}

</script>

<style scoped lang="less">
.mission-turn {
  position: absolute;
  z-index: 12;
  right: clamp(10px, 2vw, 30px);
  bottom: 14px;
  display: grid;
  justify-items: end;
  gap: 8px;
  // Only the button and its labels take clicks, not the empty corners of the column.
  pointer-events: none;

  > * {
    pointer-events: auto;
  }
}

.mission-turn__count {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border: 1px solid #6f8c98;
  border-radius: 8px;
  background: linear-gradient(#1b2a35f2, #0c151df2);
  color: #eef6f8;
  font-size: 0.9rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  box-shadow: 0 4px 12px #0008;

  &--last {
    border-color: #ffb86b;
    color: #ffd9a8;
    box-shadow: 0 0 12px #ffb86b55, 0 4px 12px #0008;
  }
}

.mission-turn__pips {
  display: flex;
  gap: 5px;

  i {
    width: 14px;
    height: 14px;
    border: 2px solid #6f8c98;
    border-radius: 50%;

    &.done {
      border-color: #8a979d;
      background: #8a979d;
    }

    &.now {
      border-color: #b4ffeb;
      background: #b4ffeb;
      box-shadow: 0 0 8px #b4ffeb;
    }
  }
}

.mission-turn__clock {
  display: grid;
  align-items: center;
  grid-template-columns: auto auto;
  gap: 0 10px;
  min-width: 170px;
  padding: 8px 16px;
  border: 2px solid #6f8c98;
  border-radius: 10px;
  background: #0b141cf0;
  box-shadow: 0 6px 16px #000a;
  color: #eef6f8;
  font-variant-numeric: tabular-nums;

  b {
    grid-column: 2;
    font-size: 2.1rem;
    font-weight: 900;
    line-height: 1;
  }

  &--warn {
    border-color: #ff7a5c;
    background: #4a140b;
    color: #ffd2c4;
    animation: mission-turn-warn 0.8s ease-in-out infinite alternate;
  }
}

.mission-turn__clock-icon {
  grid-row: span 2;
  font-size: 1.9rem;
}

.mission-turn__clock-label {
  color: #9fb8c2;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;

  .mission-turn__clock--warn & {
    color: #ffd2c4;
  }
}

@keyframes mission-turn-warn {
  from { box-shadow: 0 0 4px #ff7a5c55; }
  to { box-shadow: 0 0 16px #ff7a5ccc; }
}

.mission-turn__caption {
  max-width: 170px;
  padding: 6px 12px;
  text-align: center;
  border: 1px solid #c9a35d;
  border-radius: 4px;
  background: linear-gradient(#1b2a35f2, #0c151df2);
  color: #f6e2b8;
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  line-height: 1.2;
  text-transform: uppercase;
  box-shadow: 0 4px 12px #0008;
}

.mission-turn__button {
  display: grid;
  width: 108px;
  height: 108px;
  place-items: center;
  border: 3px solid #e2c27f;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 35%, #4fa9e6, #1d5f99 60%, #0f3557);
  box-shadow: 0 0 0 4px #0c1720, 0 0 0 6px #b48f4c, 0 8px 22px #000b, inset 0 3px 8px #ffffff59;
  color: #fff;
  font-size: 3rem;
  line-height: 1;
  cursor: pointer;
  text-shadow: 0 2px 4px #0009;

  &:hover:not(:disabled),
  &:focus-visible {
    outline: none;
    filter: brightness(1.15);
  }

  &--armed {
    background: radial-gradient(circle at 50% 35%, #6be39b, #23935a 60%, #0f4d2e);
  }

  &--idle {
    background: radial-gradient(circle at 50% 35%, #6c7a84, #3a4650 60%, #1e262d);
    cursor: default;
    filter: grayscale(0.4);
  }
}

.mission-turn__menu {
  display: grid;
  min-width: 230px;
  // Many actions: the list scrolls, the turn button below stays in place.
  max-height: min(40dvh, 380px);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: #c9a35d99 transparent;
  gap: 4px;
  margin: 0;
  padding: 6px;
  border: 1px solid #c9a35d;
  border-radius: 6px;
  background: linear-gradient(#162430f5, #0b131bf5);
  list-style: none;
  box-shadow: 0 10px 30px #000c;
}

.mission-turn__item {
  display: flex;
  width: 100%;
  min-height: 38px;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  border: 1px solid #5f7d8a;
  border-radius: 4px;
  background: #142430;
  color: #eef6f8;
  font-size: 0.85rem;
  font-weight: 600;
  text-align: left;
  cursor: pointer;

  :deep(.resource_icon) {
    width: 24px;
    height: 24px;
    flex: none;
  }

  &:hover:not(:disabled),
  &:focus-visible {
    border-color: #b4ffeb;
    background: #1f3c48;
  }

  &:disabled {
    color: #8e9aa0;
    cursor: not-allowed;
    filter: grayscale(0.8);
    opacity: 0.7;
  }

  &--pass {
    justify-content: center;
    border-color: #d9a55f;
    background: #3a2614;
    color: #ffd9a1;
    text-transform: uppercase;
  }
}

.mission-turn__effects {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.mission-turn__effect {
  display: inline-flex;
  align-items: center;
  gap: 1px;

  small {
    font-size: 0.8rem;
    font-weight: 800;
  }

  img {
    width: 26px;
    height: 26px;
    object-fit: contain;
  }

  &--production img {
    padding: 2px;
    border-radius: 3px;
    background: #8a5a2b;
  }
}

.mission-turn__item--card {
  border-color: #3c9be6;
}

.mission-turn__badge {
  display: inline-grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border-radius: 50%;
  background: #3c9be6;
  color: #fff;
}

.mission-turn__kind {
  margin-left: auto;
  color: #9fd2ff;
  font-size: 0.7rem;
}

.mission-turn__cost {
  display: inline-grid;
  min-width: 24px;
  height: 24px;
  place-items: center;
  margin-left: auto;
  padding: 0 4px;
  border: 1px solid #6b4b00;
  border-radius: 4px;
  background: linear-gradient(#ffe36b, #f0b20f);
  color: #1b1200;
  font-weight: 800;
}
</style>

