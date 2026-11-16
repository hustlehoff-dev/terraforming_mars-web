<template>
  <button v-if="colonies.length" type="button" class="mission-colonies-trigger" aria-haspopup="dialog" @click="openWindow">
    <span aria-hidden="true">🪐</span>{{ $t('Colonies') }}
  </button>
  <dialog v-if="colonies.length" ref="dialog" class="mission-colonies" :aria-label="$t('Colonies')" @click.self="closeWindow">
    <header>
      <h2 v-i18n>Colonies</h2>
    </header>
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
    <!-- Trading: what sending a ship costs, and why it cannot be done right now. -->
    <div class="mission-colonies__trade-bar">
      <span class="mission-colonies__trade-title"><span aria-hidden="true">🚀</span>{{ $t('Send a trade ship') }}</span>
      <span class="mission-colonies__costs">
        <template v-for="(cost, index) in costs" :key="index">
          <span v-if="index > 0" class="mission-colonies__or" v-i18n>or</span>
          <span class="mission-colonies__cost">{{ cost }}</span>
        </template>
      </span>
      <button v-if="canTrade" type="button" class="mission-close mission-colonies__trade" @click="trade" v-i18n>Send a ship</button>
      <small v-else class="mission-colonies__why">{{ $t(whyNot) }}</small>
    </div>
    <div class="mission-colonies__tiles">
      <div v-for="colony in colonies" :key="colony.name" class="mission-colonies__tile" :class="{'mission-colonies__tile--inactive': !colony.isActive}">
        <Colony :colony="colony" :active="colony.isActive" />
      </div>
    </div>
    <footer class="mission-window-footer">
      <button type="button" class="mission-close" @click="closeWindow" v-i18n>Close</button>
    </footer>
  </dialog>
</template>

<script setup lang="ts">
import {computed, ref} from 'vue';
import Colony from '@/client/components/colonies/Colony.vue';
import {ColonyModel} from '@/common/models/ColonyModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';
import {Message} from '@/common/logs/Message';
import {ENERGY_TRADE_COST, MC_TRADE_COST, TITANIUM_TRADE_COST} from '@/common/constants';
import {translateMessage, translateTextWithParams} from '@/client/directives/i18n';

/*
 * The colony tiles of the Colonies expansion (they lie next to the board, not on Mars): a button
 * that opens a window with every tile, its track, its colonies and the ships trading there, and
 * the trade fleets each player still has this generation.
 */
const props = defineProps<{
  colonies: ReadonlyArray<ColonyModel>,
  players: ReadonlyArray<PublicPlayerModel>,
  canTrade?: boolean,
  /** The ways to pay for a trade offered right now (with the player's discounts), from the action menu. */
  tradeCosts?: ReadonlyArray<string | Message>,
  myColor?: Color,
}>();
const emit = defineEmits<{trade: []}>();
const dialog = ref<HTMLDialogElement>();

function freeFleets(player: PublicPlayerModel): number {
  return Math.max(0, player.fleetSize - player.tradesThisGeneration);
}

/** "Pay 9 M€" -> "9 M€": the offered ways to pay, or the standard costs when trading is not offered. */
const costs = computed(() => {
  if (props.tradeCosts?.length) {
    return props.tradeCosts.map((cost) => (typeof cost === 'string' ? cost : translateMessage(cost)).replace(/^(Pay|Wydaj|Zapłać)\s*:?\s*/i, ''));
  }
  return [
    translateTextWithParams('${0} M€', [String(MC_TRADE_COST)]),
    translateTextWithParams('${0} energy', [String(ENERGY_TRADE_COST)]),
    translateTextWithParams('${0} titanium', [String(TITANIUM_TRADE_COST)]),
  ];
});

const whyNot = computed(() => {
  const me = props.players.find((player) => player.color === props.myColor);
  if (me !== undefined && freeFleets(me) === 0) {
    return 'No free trade ship this generation';
  }
  return 'You can trade as an action on your turn';
});

function openWindow() {
  const window = dialog.value;
  if (window !== undefined && !window.open && typeof window.showModal === 'function') {
    window.showModal();
  }
}

function closeWindow() {
  if (typeof dialog.value?.close === 'function') {
    dialog.value.close();
  }
}

function trade() {
  closeWindow();
  emit('trade');
}

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

  &::backdrop {
    background: #03070cb3;
    backdrop-filter: blur(4px);
  }

  header {
    position: sticky;
    z-index: 2;
    top: 0;
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
  .mission-close {
    min-width: 0;
    flex: 0 1 160px;
    padding-inline: 12px;
  }

  .mission-colonies__trade {
    border-color: #e2c27f;
    color: #ffedc6;
  }
}

.mission-colonies__trade-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
  padding: 10px 18px;
  border-bottom: 1px solid #ffffff14;
  background: #e2c27f14;

  .mission-colonies__trade {
    min-width: 0;
    min-height: 36px;
    margin-left: auto;
    padding-inline: 18px;
    border-color: #e2c27f;
    color: #ffedc6;
  }
}

.mission-colonies__trade-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #f6e2b8;
  font-weight: 800;
  text-transform: uppercase;
}

.mission-colonies__costs {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.mission-colonies__cost {
  padding: 3px 9px;
  border: 1px solid #6f8c98;
  border-radius: 999px;
  background: #0b141c;
  font-weight: 700;
}

.mission-colonies__or {
  color: #9fb8c2;
  font-size: 0.85rem;
}

.mission-colonies__why {
  margin-left: auto;
  color: #9fb8c2;
  font-size: 0.85rem;
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
