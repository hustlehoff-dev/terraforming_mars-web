<template>
  <div class="mission-setup setup-screen player_home_block player_home_block--setup nofloat">
    <a name="board" class="player_home_anchor hotkey-target"></a>
    <header class="setup-screen__hero">
      <div>
        <p class="setup-screen__kicker">{{ $t(game.gameOptions.boardName) }} · <span v-i18n>Generation</span> {{ game.generation }}</p>
        <h1 v-i18n>Game setup</h1>
      </div>
      <!-- Who plays, in turn order, and who is still choosing. -->
      <ol v-if="playerView.players.length > 1" class="setup-players" :aria-label="$t('Players')">
        <li v-for="(player, index) in playerView.players" :key="player.color" class="setup-players__player"
          :class="['player_bg_color_' + player.color, {'setup-players__player--me': player.color === thisPlayer.color}]">
          <span class="setup-players__order">{{ index + 1 }}</span>
          <strong>{{ player.name }}</strong>
          <small v-if="player.color === thisPlayer.color" v-i18n>(you)</small>
          <span class="setup-players__state" :class="{'setup-players__state--ready': isReady(player)}">{{ $t(isReady(player) ? 'Ready' : 'Choosing') }}</span>
        </li>
      </ol>
    </header>

    <div v-if="!choosingCorporation && playerView.waitingFor === undefined" class="setup-screen__wait" role="status">
      <span class="setup-screen__spinner" aria-hidden="true"></span>
      <div>
        <strong v-i18n>Your choice is saved</strong>
        <p>{{ waitingText }}</p>
      </div>
    </div>

    <a name="actions" class="player_home_anchor hotkey-target"></a>
    <WaitingFor v-if="game.phase !== 'end'" :playerView="playerView" :waitingfor="playerView.waitingFor" :requestId="playerView.requestId" />

    <section v-for="group in cardGroups" :key="group.key" class="setup-screen__group">
      <h2>{{ $t(group.title) }} <small>{{ group.cards.length }}</small></h2>
      <div class="setup-screen__cards">
        <div v-for="card in group.cards" :key="card.name" class="cardbox">
          <Card :card="card" />
        </div>
      </div>
    </section>

    <details class="setup-screen__more" :open="!choosingCorporation && cardGroups.length === 0">
      <summary v-i18n>Board, milestones and awards</summary>
      <AtlasBoard :game="game" :tileView="tileView" @toggleTileView="$emit('toggleTileView')" />
      <slot></slot>
      <div v-if="playerView.players.length > 1" class="setup-screen__ma">
        <Milestones :showScores="false" :milestones="game.milestones" />
        <Awards :show-scores="false" :awards="game.awards" />
      </div>
      <div v-if="game.turmoil || game.gameOptions.expansions.pathfinders || game.moon || game.gameOptions.expansions.deltaProject" class="setup-screen__expansions">
        <Turmoil v-if="game.turmoil" :turmoil="game.turmoil" />
        <PlanetaryTracks v-if="game.gameOptions.expansions.pathfinders" :tracks="game.pathfinders" :gameOptions="game.gameOptions" />
        <a name="moonBoard" class="player_home_anchor"></a>
        <MoonBoard v-if="game.moon !== undefined" :model="game.moon" :tileView="tileView" id="shortkey-moonBoard" />
        <DeltaProjectBoard v-if="game.gameOptions.expansions.deltaProject" :players="playerView.players" />
      </div>
    </details>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

import AtlasBoard from '@/client/components/board/AtlasBoard.vue';
import Card from '@/client/components/card/Card.vue';
import DeltaProjectBoard from '@/client/components/delta/DeltaProjectBoard.vue';
import Milestones from '@/client/components/Milestones.vue';
import Awards from '@/client/components/Awards.vue';
import WaitingFor from '@/client/components/WaitingFor.vue';
import Turmoil from '@/client/components/turmoil/Turmoil.vue';
import MoonBoard from '@/client/components/moon/MoonBoard.vue';
import PlanetaryTracks from '@/client/components/pathfinders/PlanetaryTracks.vue';
import {CardModel} from '@/common/models/CardModel';
import {Phase} from '@/common/Phase';
import {GameModel} from '@/common/models/GameModel';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {TileView} from './board/TileView';

export default defineComponent({
  name: 'PlayerSetupView',
  props: {
    playerView: {
      type: Object as () => PlayerViewModel,
      required: true,
    },
    tileView: {
      type: String as () => TileView,
      required: true,
    },
  },
  emits: ['toggleTileView'],
  computed: {
    choosingCorporation(): boolean {
      return this.playerView.waitingFor?.type === 'initialCards';
    },
    thisPlayer(): PublicPlayerModel {
      return this.playerView.thisPlayer;
    },
    game(): GameModel {
      return this.playerView.game;
    },
    /** The cards of this player, grouped: chosen ones once chosen, else the ones dealt or drafted. */
    cardGroups(): Array<{key: string, title: string, cards: ReadonlyArray<CardModel>}> {
      const view = this.playerView;
      const groups: Array<{key: string, title: string, cards: ReadonlyArray<CardModel>}> = [];
      if (this.choosingCorporation) {
        return groups;
      }
      if (view.pickedCorporationCard.length > 0) {
        groups.push({key: 'corp', title: 'Corporation', cards: view.pickedCorporationCard});
        if (this.game.gameOptions.expansions.prelude && view.preludeCardsInHand.length > 0) {
          groups.push({key: 'prelude', title: 'Preludes', cards: view.preludeCardsInHand});
        }
        if (this.game.gameOptions.expansions.ceo && view.ceoCardsInHand.length > 0) {
          groups.push({key: 'ceo', title: 'CEO', cards: view.ceoCardsInHand});
        }
        if (view.cardsInHand.length > 0) {
          groups.push({key: 'hand', title: 'Project cards', cards: view.cardsInHand});
        }
      } else if (this.isInitialDraftingPhase) {
        const dealt: Array<[string, string, ReadonlyArray<CardModel>]> = [
          ['dcorp', 'Corporations', view.dealtCorporationCards],
          ['dprelude', 'Preludes', view.dealtPreludeCards],
          ['dceo', 'CEO', view.dealtCeoCards],
          ['dproject', 'Project cards', view.dealtProjectCards],
        ];
        for (const [key, title, cards] of dealt) {
          if (cards.length > 0) {
            groups.push({key, title, cards});
          }
        }
      }
      if (view.draftedCards.length > 0) {
        groups.push({key: 'drafted', title: 'Drafted Cards', cards: view.draftedCards});
      }
      return groups;
    },
    waitingText(): string {
      const choosing = this.playerView.players.filter((player) => !this.isReady(player)).map((player) => player.name);
      return choosing.length > 0 ? `${this.$t('Waiting for')}: ${choosing.join(', ')}` : this.$t('The game starts in a moment');
    },
    isInitialDraftingPhase(): boolean {
      return (this.game.phase === Phase.INITIALDRAFTING) && this.game.gameOptions.initialDraftVariant;
    },
  },
  components: {
    AtlasBoard,
    Card,
    DeltaProjectBoard,
    WaitingFor,
    Milestones,
    Awards,
    Turmoil,
    PlanetaryTracks,
    MoonBoard,
  },
  methods: {
    isReady(player: PublicPlayerModel): boolean {
      return player.needsToResearch === false || (player.needsToResearch === undefined && player.needsToDraft === false);
    },
  },
});
</script>

<style lang="less">
.setup-players {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 12px;
  padding: 0;
  list-style: none;
}

.setup-players__player {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px 6px 6px;
  border-radius: 10px;
  color: #fff;
  font-size: 1rem;
  text-shadow: 0 1px 2px #000;
  box-shadow: inset 0 0 0 1px #ffffff33, 0 3px 8px #0008;

  &--me {
    box-shadow: 0 0 0 2px #e2c27f, 0 3px 10px #000a;
  }
}

.setup-players__order {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 50%;
  background: #0007;
  font-weight: 800;
}

.setup-players__state {
  padding: 1px 8px;
  border-radius: 8px;
  background: #0008;
  font-size: 0.8rem;
}

.setup-screen {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1500px;
  margin: 0 auto;
  color: #e9f2f5;
}

.setup-screen__hero {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px;
  border: 1px solid #ffffff1f;
  border-radius: 16px;
  background: radial-gradient(circle at 0 0, #c1440e33, transparent 60%), linear-gradient(160deg, #13212bf2, #0a1218f2);
  box-shadow: 0 10px 28px #0008;

  h1 {
    margin: 0;
    color: #fff;
    font-size: 2rem;
  }

  .setup-players {
    margin: 0;
  }
}

.setup-screen__kicker {
  margin: 0 0 4px;
  color: #e2c27f;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.setup-players__state--ready {
  background: #1f7a4ccc;
}

.setup-screen__wait {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  border: 1px solid #3cf59a55;
  border-radius: 14px;
  background: #0d1f18e6;

  strong {
    font-size: 1.1rem;
  }

  p {
    margin: 2px 0 0;
    color: #9fb6bf;
  }
}

.setup-screen__spinner {
  width: 26px;
  height: 26px;
  flex: none;
  border: 3px solid #3cf59a33;
  border-top-color: #3cf59a;
  border-radius: 50%;
  animation: setup-spin 900ms linear infinite;
}

@keyframes setup-spin {
  to { transform: rotate(360deg); }
}

.setup-screen__group {
  padding: 14px 16px;
  border: 1px solid #ffffff17;
  border-radius: 14px;
  background: #0b141ccc;

  h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 10px;
    color: #fff;
    font-size: 1.1rem;

    small {
      padding: 0 8px;
      border-radius: 8px;
      background: #ffffff1a;
      color: #9fb6bf;
      font-size: 0.8rem;
    }
  }
}

.setup-screen__cards {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;

  .cardbox {
    margin: 0;
  }
}

.setup-screen__more {
  padding: 10px 16px;
  border: 1px solid #ffffff17;
  border-radius: 14px;
  background: #0b141ccc;

  > summary {
    color: #cfe0e6;
    font-weight: 700;
    cursor: pointer;
  }
}

.setup-screen__ma {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 12px;
}
</style>
