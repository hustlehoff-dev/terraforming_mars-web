<template>
  <button v-if="colonies.length" type="button" class="mission-colonies-trigger" aria-haspopup="dialog" @click="openWindow">
    <span aria-hidden="true">🪐</span>{{ $t('Colonies') }}
  </button>
  <!-- The trigger is inside collapsible parameters. A modal must not inherit that hidden ancestor. -->
  <Teleport to="body">
    <dialog v-if="colonies.length" ref="dialog" class="mission-colonies" :aria-label="$t('Colonies')"
      @click.self="closeWindow" @cancel.prevent="closeWindow" @close="picked = undefined">
      <header>
        <h2 v-i18n>Colonies</h2>
        <small v-if="tradeable.size" class="mission-colonies__hint" v-i18n>Click a colony to trade with, then choose how to pay.</small>
        <button type="button" class="mission-colonies__close" :aria-label="$t('Close')" @click="closeWindow">×</button>
      </header>
      <!-- How colonies work, in three lines (open until the player folds it). -->
      <details class="mission-colonies__legend" :open="legendOpen" @toggle="rememberLegend">
        <summary v-i18n>How do colonies work?</summary>
        <ul>
          <li><b v-i18n>Ship</b> <span v-i18n>Once per generation per ship: pay 9 M€, 3 energy or 3 titanium and get the trade income, the number under the white cube. The cube then moves back and climbs again each generation.</span></li>
          <li><b v-i18n>Colony</b> <span v-i18n>Standard project (17 M€): your marker on the first free space, you get what is drawn there. From then on, every trade with this moon, by anyone, gives you its BONUS.</span></li>
          <li><b v-i18n>Grey moon</b> <span v-i18n>Not active yet: it opens when someone plays a card that holds its resource.</span></li>
        </ul>
      </details>
      <!-- Trade fleets still free this generation, per player. -->
      <ul v-if="players.length" class="mission-colonies__fleets" :aria-label="$t('Trade fleets')">
        <li v-for="player in players" :key="player.color">
          <span class="mission-colonies__swatch" :class="'player_bg_color_' + player.color" aria-hidden="true"></span>
          <span>{{ player.name }}</span>
          <span class="mission-colonies__ships">
            <span v-for="index in freeFleets(player)" :key="index" :class="'colonies-fleet colonies-fleet-' + player.color" aria-hidden="true"></span>
          </span>
          <small>{{ freeFleets(player) }} / {{ player.fleetSize }}</small>
        </li>
      </ul>
      <!-- While trading is possible: colonies open for trade are lit and chosen with a click. -->
      <div class="mission-colonies__tiles">
        <component :is="tradeable.has(colony.name) ? 'button' : 'div'" v-for="colony in colonies" :key="colony.name"
          :type="tradeable.has(colony.name) ? 'button' : undefined" class="mission-colonies__tile"
          :class="{
            'mission-colonies__tile--inactive': !colony.isActive,
            'mission-colonies__tile--open': tradeable.has(colony.name),
            'mission-colonies__tile--closed': tradeable.size > 0 && !tradeable.has(colony.name),
            'mission-colonies__tile--picked': picked === colony.name,
          }"
          :aria-pressed="tradeable.has(colony.name) ? picked === colony.name : undefined"
          @click="tradeable.has(colony.name) && (picked = colony.name)">
          <Colony :colony="colony" :active="colony.isActive" />
        </component>
      </div>
      <footer class="mission-window-footer">
        <button type="button" class="mission-close" @click="closeWindow" v-i18n>Close</button>
        <button v-for="pay in payments" :key="pay.index" type="button" class="mission-close mission-colonies__trade"
          :disabled="picked === undefined" @click="trade(pay.index)">{{ pay.label }}</button>
      </footer>
    </dialog>
  </Teleport>
</template>

<script setup lang="ts">
import {computed, nextTick, onBeforeUnmount, ref, watch} from 'vue';
import Colony from '@/client/components/colonies/Colony.vue';
import {ColonyModel} from '@/common/models/ColonyModel';
import {ColonyName} from '@/common/colonies/ColonyName';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {InputResponse} from '@/common/inputs/InputResponse';
import {translateMessage, translateTextWithParams} from '@/client/directives/i18n';

/*
 * The colony tiles of the Colonies expansion (they lie next to the board, not on Mars): a button
 * that opens a window with every tile, its track, its colonies and the ships trading there, and
 * the trade fleets each player still has this generation. When the player can trade, the open
 * colonies are lit: click one, then "Trade: 9 M€" (or another way to pay) at the bottom.
 */
const LEGEND_KEY = 'colonies-legend-folded';
function initialLegendOpen(): boolean {
  try {
    const saved = window.localStorage.getItem(LEGEND_KEY);
    if (saved !== null) {
      return saved === '0';
    }
  } catch {
    // Use the screen's default when storage is unavailable.
  }
  return window.matchMedia?.('(max-width: 760px)').matches !== true;
}
const legendOpen = ref(initialLegendOpen());
function rememberLegend(event: Event) {
  const open = (event.target as HTMLDetailsElement).open;
  legendOpen.value = open;
  try {
    window.localStorage.setItem(LEGEND_KEY, open ? '0' : '1');
  } catch {
    // Only for this page.
  }
}

const props = defineProps<{
  colonies: ReadonlyArray<ColonyModel>,
  players: ReadonlyArray<PublicPlayerModel>,
  /** "Trade with a colony tile" from the action menu (how to pay, then which colony), when it can be done now. */
  tradeInput?: PlayerInputModel,
}>();
const emit = defineEmits<{trade: [response: InputResponse]}>();
const dialog = ref<HTMLDialogElement>();
const picked = ref<ColonyName>();

function freeFleets(player: PublicPlayerModel): number {
  return Math.max(0, player.fleetSize - player.tradesThisGeneration);
}

const payInput = computed(() => props.tradeInput?.type === 'and' ? props.tradeInput.options[0] : undefined);
const colonyInput = computed(() => props.tradeInput?.type === 'and' ? props.tradeInput.options[1] : undefined);
const tradeable = computed(() => new Set(colonyInput.value?.type === 'colony' ? colonyInput.value.coloniesModel.map((colony) => colony.name) : []));

/** One button per way to pay, e.g. "Trade: 9 M€", "Trade: 3 energy". */
const payments = computed(() => {
  const pay = payInput.value;
  if (pay?.type !== 'or' || tradeable.value.size === 0) {
    return [];
  }
  return pay.options.map((option, index) => {
    const title = typeof option.title === 'string' ? translateTextWithParams(option.title, []) : translateMessage(option.title);
    return {index, label: translateTextWithParams('Trade: ${0}', [title.replace(/^(Pay|Wydaj|Zapłać)\s*:?\s*/i, '')])};
  });
});

// A colony that is no longer open (or the end of trading) clears the choice.
watch(tradeable, (open) => {
  if (picked.value !== undefined && !open.has(picked.value)) {
    picked.value = undefined;
  }
});

async function openWindow() {
  // Let the action menu close and the teleported dialog finish mounting before taking focus.
  await nextTick();
  const element = dialog.value;
  if (element !== undefined && element.isConnected && !element.open && typeof element.showModal === 'function') {
    element.showModal();
  }
}

function closeWindow() {
  picked.value = undefined;
  if (typeof dialog.value?.close === 'function') {
    dialog.value.close();
  }
}

onBeforeUnmount(closeWindow);

function trade(payIndex: number) {
  const colonyName = picked.value;
  if (colonyName === undefined) {
    return;
  }
  closeWindow();
  emit('trade', {type: 'and', responses: [{type: 'or', index: payIndex, response: {type: 'option'}}, {type: 'colony', colonyName}]});
}

defineExpose({openWindow});

</script>

<style lang="less">
.mission-colonies-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

// In the right column it looks like the buttons next to it (Awards, Milestones...).
.mission-params__buttons .mission-colonies-trigger {
  display: flex;
  min-width: 0;
  min-height: 34px;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px 5px;
  border: 1px solid #6f8c98;
  border-radius: 6px;
  background: linear-gradient(#1b2e3d, #0d1720);
  color: #eef6f8;
  font: inherit;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0;
  line-height: 1.15;
  text-align: center;
  text-transform: uppercase;
  overflow-wrap: anywhere;

  &:hover,
  &:focus-visible {
    outline: none;
    border-color: #b4ffeb;
    background: #1f3c48;
  }
}

.mission-colonies {
  box-sizing: border-box;
  width: min(1320px, calc(100vw - 32px));
  max-width: none;
  max-height: 92dvh;
  padding: 0;
  // The window fits its tiles; only a screen too short for them scrolls the whole window.
  overflow-y: auto;
  border: 1px solid #e2c27f99;
  border-radius: 14px;
  background: linear-gradient(#152330f5, #0b131bf5);
  box-shadow: 0 24px 60px #000d;
  color: #eef6f8;
  font-family: Ubuntu, Arial, sans-serif;

  &::backdrop {
    background: #03070cb3;
    backdrop-filter: blur(4px);
  }

  header {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 18px;
    border-bottom: 1px solid #ffffff1f;
    background: #152330;

    h2 {
      margin: 0;
      padding: 0;
      color: #f6e2b8;
      font-size: 1.1rem;
      filter: none;
      text-transform: uppercase;
    }
  }
}

@media (max-width: 760px) {
  dialog.mission-colonies {
    position: fixed;
    inset: 0;
    width: calc(100vw - 16px);
    max-height: calc(100dvh - 16px);
    margin: auto;
    overscroll-behavior: contain;

    header {
      position: sticky;
      z-index: 3;
      top: 0;
      flex-wrap: wrap;
      gap: 6px;
      padding: 10px 12px;

      h2 { flex: 1; font-size: 18px; }
    }

    .mission-colonies__close { width: 40px; height: 40px; flex: none; }
    .mission-colonies__hint { order: 3; flex-basis: 100%; font-size: 13px; line-height: 1.35; }
    .mission-colonies__legend { padding: 10px 12px; font-size: 13px; }
    .mission-colonies__fleets { gap: 6px 12px; padding: 8px 12px; font-size: 13px; }
    .mission-colonies__tiles { gap: 14px; padding: 16px 10px; }
    .mission-colonies__tile .colony-card { zoom: 0.78; }
    .mission-window-footer {
      position: sticky;
      z-index: 3;
      bottom: 0;
      gap: 6px;
      padding: 10px;
      background: #0d1a24;

      .mission-close { min-height: 42px; flex: 1 1 140px; padding: 6px 8px; font-size: 13px; }
    }
  }
}

@media (max-width: 360px) {
  dialog.mission-colonies .mission-colonies__tile .colony-card { zoom: 0.63; }
}

.mission-colonies__close {
  display: grid;
  width: 34px;
  height: 34px;
  margin-left: auto;
  place-items: center;
  border: 1px solid #6f8c98;
  border-radius: 8px;
  background: #0b141c;
  color: #eef6f8;
  font-size: 1.4rem;
  cursor: pointer;
}

.mission-colonies .mission-window-footer {
  flex-wrap: wrap;

  .mission-close {
    min-width: 0;
    flex: 0 1 200px;
    padding-inline: 12px;
  }

  .mission-colonies__trade {
    border-color: #e2c27f;
    color: #ffedc6;

    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
  }
}

.mission-colonies__hint {
  color: #cfe0e6;
  font-size: 0.85rem;
}

.mission-colonies__legend {
  margin: 0;
  padding: 8px 18px;
  border-bottom: 1px solid #ffffff14;
  color: #cfe0e6;
  font-size: 0.85rem;

  summary {
    color: #f6e2b8;
    font-weight: 700;
    cursor: pointer;
  }

  ul {
    display: grid;
    gap: 4px;
    margin: 6px 0 0;
    padding: 0;
    list-style: none;
  }

  b {
    display: inline-block;
    min-width: 92px;
    color: #a2eeff;
  }
}

.mission-colonies__fleets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin: 0;
  padding: 10px 18px;
  border-bottom: 1px solid #ffffff14;
  list-style: none;

  li {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  small {
    color: #9fb8c2;
  }
}

.mission-colonies__swatch {
  width: 10px;
  height: 22px;
  border-radius: 3px;
}

.mission-colonies__ships {
  display: inline-flex;
  gap: 2px;

  .colonies-fleet {
    display: inline-block;
    margin: 0;
    zoom: 0.6;
  }
}

.mission-colonies__tiles {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16px;
  padding: 22px 18px 26px;
}

.mission-colonies__tile {
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: none;
  font: inherit;

  &--open {
    cursor: pointer;

    .colony-card {
      box-shadow: 0 0 0 2px #e2c27f, 0 10px 24px #000a;
    }

    &:hover .colony-card {
      box-shadow: 0 0 0 3px #ffe9bd, 0 0 18px #e2c27f88;
    }
  }

  &--picked .colony-card,
  &--picked:hover .colony-card {
    box-shadow: 0 0 0 4px #b4ffeb, 0 0 24px #b4ffeb99;
  }

  &--closed {
    opacity: 0.4;
  }

  .colony-card {
    margin: 0;
    border-radius: 10px;
    box-shadow: 0 0 0 1px #6f8c98, 0 10px 24px #000a;
    zoom: 0.85;
  }

  &--inactive {
    opacity: 0.55;
  }
}
</style>
