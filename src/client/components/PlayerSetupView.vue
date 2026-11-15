<template>
  <div class="mission-setup setup-page nofloat">
    <a name="board" class="player_home_anchor hotkey-target"></a>

    <header class="setup-hero">
      <div class="setup-hero__text">
        <p class="setup-hero__kicker">Terraforming Mars</p>
        <h1 v-i18n>Game setup</h1>
        <ul class="setup-hero__chips">
          <li><span aria-hidden="true">🗺</span>{{ $t(game.gameOptions.boardName) }}</li>
          <li><span aria-hidden="true">👥</span>{{ playerView.players.length }} {{ $t('players') }}</li>
          <li v-for="expansion in expansions" :key="expansion"><span aria-hidden="true">✦</span>{{ $t(expansion) }}</li>
        </ul>
      </div>
      <img class="setup-hero__dome" src="assets/board/mars-dome.png" alt="">
    </header>

    <section v-if="playerView.players.length > 1" class="setup-section">
      <h2 class="setup-heading"><span v-i18n>Players</span><small v-i18n>Turn order</small></h2>
      <ol class="setup-crew">
        <li v-for="(player, index) in playerView.players" :key="player.color" class="setup-crew__player"
          :class="['setup-crew__player--' + player.color, {'setup-crew__player--me': player.color === thisPlayer.color, 'setup-crew__player--ready': isReady(player)}]">
          <span class="setup-crew__order">{{ index + 1 }}</span>
          <span class="setup-crew__swatch" :class="'player_bg_color_' + player.color" aria-hidden="true"></span>
          <span class="setup-crew__name">
            <strong>{{ player.name }}</strong>
            <small v-if="player.color === thisPlayer.color" v-i18n>(you)</small>
          </span>
          <span class="setup-crew__state">
            <span v-if="!isReady(player)" class="setup-spinner setup-spinner--small" aria-hidden="true"></span>
            <span v-else aria-hidden="true">✓</span>
            {{ $t(isReady(player) ? 'Ready' : 'Choosing') }}
          </span>
        </li>
      </ol>
    </section>

    <div v-if="showsWaiting" class="setup-waiting" role="status">
      <span class="setup-spinner" aria-hidden="true"></span>
      <div>
        <strong v-i18n>Your choice is saved</strong>
        <p>{{ waitingText }}</p>
      </div>
    </div>

    <a name="actions" class="player_home_anchor hotkey-target"></a>
    <!-- Always mounted: it also keeps the page up to date while waiting for the other players. -->
    <section v-show="playerView.waitingFor !== undefined" class="setup-section setup-section--input">
      <WaitingFor v-if="game.phase !== 'end'" :playerView="playerView" :waitingfor="playerView.waitingFor" :requestId="playerView.requestId" />
    </section>

    <section v-for="group in cardGroups" :key="group.key" class="setup-section">
      <h2 class="setup-heading"><span>{{ $t(group.title) }}</span><small>{{ group.cards.length }}</small></h2>
      <div class="setup-cards">
        <div v-for="card in group.cards" :key="card.name" class="cardbox">
          <Card :card="card" />
        </div>
      </div>
    </section>

    <details class="setup-section setup-more" :open="boardOpen" @toggle="boardOpen = ($event.target as HTMLDetailsElement).open">
      <summary class="setup-heading"><span v-i18n>Board, milestones and awards</span><small aria-hidden="true">{{ boardOpen ? '−' : '+' }}</small></summary>
      <template v-if="boardOpen">
        <AtlasBoard :game="game" :tileView="tileView" @toggleTileView="$emit('toggleTileView')" />
        <div v-if="playerView.players.length > 1" class="setup-more__ma">
          <Milestones :showScores="false" :milestones="game.milestones" />
          <Awards :show-scores="false" :awards="game.awards" />
        </div>
        <div v-if="game.turmoil || game.gameOptions.expansions.pathfinders || game.moon || game.gameOptions.expansions.deltaProject">
          <Turmoil v-if="game.turmoil" :turmoil="game.turmoil" />
          <PlanetaryTracks v-if="game.gameOptions.expansions.pathfinders" :tracks="game.pathfinders" :gameOptions="game.gameOptions" />
          <a name="moonBoard" class="player_home_anchor"></a>
          <MoonBoard v-if="game.moon !== undefined" :model="game.moon" :tileView="tileView" id="shortkey-moonBoard" />
          <DeltaProjectBoard v-if="game.gameOptions.expansions.deltaProject" :players="playerView.players" />
        </div>
      </template>
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

type CardGroup = {key: string, title: string, cards: ReadonlyArray<CardModel>};

const EXPANSION_LABELS: Record<string, string> = {
  corpera: 'Corporate Era', prelude: 'Prelude', prelude2: 'Prelude 2', venus: 'Venus Next', colonies: 'Colonies', turmoil: 'Turmoil',
  promo: 'Promos', ares: 'Ares', community: 'Community', moon: 'The Moon', pathfinders: 'Pathfinders', ceo: 'CEOs',
  starwars: 'Star Wars', underworld: 'Underworld', deltaProject: 'Delta Project',
};

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
  data(): {boardOpen: boolean} {
    return {boardOpen: false};
  },
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
    isInitialDraftingPhase(): boolean {
      return (this.game.phase === Phase.INITIALDRAFTING) && this.game.gameOptions.initialDraftVariant;
    },
    expansions(): Array<string> {
      return Object.entries(this.game.gameOptions.expansions)
        .filter(([key, on]) => on && key !== 'corpera')
        .map(([key]) => EXPANSION_LABELS[key] ?? key);
    },
    /** Nothing to choose now: this player's choice is in, the others are still choosing. */
    showsWaiting(): boolean {
      return this.playerView.waitingFor === undefined && this.game.phase !== Phase.END;
    },
    /** The cards of this player, grouped: chosen ones once chosen, else the ones dealt or drafted. */
    cardGroups(): Array<CardGroup> {
      const view = this.playerView;
      const groups: Array<CardGroup> = [];
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
      if (player.color === this.thisPlayer.color) {
        return this.playerView.waitingFor === undefined;
      }
      if (this.game.phase === Phase.INITIALDRAFTING || this.game.phase === Phase.DRAFTING) {
        return player.needsToDraft === false;
      }
      return player.needsToResearch === false;
    },
  },
});
</script>

<style lang="less">
// Game setup: a page of its own over a view of Mars, before the first generation.
.setup-page {
  --setup-accent: #f07a2a;
  --setup-gold: #f3c46b;
  --setup-panel: #120d0bd9;
  --setup-line: #f07a2a40;
  --setup-text: #f6ece2;
  --setup-muted: #c7b3a3;

  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 1500px;
  margin: 0 auto;
  padding: 0 16px 32px;
  color: var(--setup-text);
}

.setup-hero {
  position: relative;
  display: flex;
  overflow: hidden;
  min-height: 210px;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  padding: 26px 30px;
  border: 1px solid var(--setup-line);
  border-radius: 20px;
  background:
    linear-gradient(90deg, #0b0705f0 0%, #0b0705b0 45%, #0b070520 100%),
    url(./assets/board/mars-orbit.jpg) center 35% / cover no-repeat,
    #1b0f09;
  box-shadow: 0 18px 40px #000a;

  h1 {
    margin: 0;
    color: #fff;
    font-size: clamp(2rem, 5vw, 3.4rem);
    line-height: 1.05;
    text-shadow: 0 3px 16px #000;
  }
}

.setup-hero__text {
  position: relative;
  z-index: 1;
}

.setup-hero__kicker {
  margin: 0 0 6px;
  color: var(--setup-gold);
  font-size: 0.85rem;
  font-weight: 800;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.setup-hero__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 16px 0 0;
  padding: 0;
  list-style: none;

  li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border: 1px solid #ffffff2e;
    border-radius: 999px;
    background: #0008;
    backdrop-filter: blur(6px);
    font-size: 0.85rem;
  }
}

.setup-hero__dome {
  width: clamp(110px, 18vw, 230px);
  flex: none;
  filter: drop-shadow(0 10px 24px #000c);
}

.setup-section {
  padding: 16px 18px;
  border: 1px solid var(--setup-line);
  border-radius: 16px;
  background: var(--setup-panel);
  box-shadow: 0 10px 26px #0008;

  &--input {
    padding: 12px;
  }
}

.setup-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 12px;
  color: #fff;
  font-size: 1.05rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;

  &::before {
    content: '';
    width: 5px;
    height: 20px;
    border-radius: 2px;
    background: var(--setup-accent);
    transform: skewX(-18deg);
  }

  small {
    padding: 1px 9px;
    border-radius: 8px;
    background: #ffffff17;
    color: var(--setup-muted);
    font-size: 0.75rem;
    letter-spacing: 0.04em;
  }
}

.setup-crew {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
}

.setup-crew__player {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid #ffffff1f;
  border-radius: 12px;
  background: #ffffff0a;

  &--me {
    border-color: var(--setup-gold);
    box-shadow: 0 0 0 1px var(--setup-gold), 0 0 18px #f3c46b33;
  }
}

.setup-crew__order {
  display: grid;
  width: 28px;
  height: 28px;
  flex: none;
  place-items: center;
  border-radius: 50%;
  background: #ffffff1a;
  font-weight: 900;
}

.setup-crew__swatch {
  width: 10px;
  height: 34px;
  flex: none;
  border-radius: 4px;
}

.setup-crew__name {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: baseline;
  gap: 6px;

  strong {
    overflow: hidden;
    font-size: 1.05rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    color: var(--setup-muted);
  }
}

.setup-crew__state {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 999px;
  background: #f07a2a26;
  color: #ffcfa8;
  font-size: 0.8rem;
  font-weight: 700;
  white-space: nowrap;

  .setup-crew__player--ready & {
    background: #2fae6a2e;
    color: #9ff0c4;
  }
}

.setup-waiting {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  border: 1px solid #2fae6a66;
  border-radius: 16px;
  background: linear-gradient(90deg, #0f2219e6, #120d0bd9);

  strong {
    font-size: 1.15rem;
  }

  p {
    margin: 3px 0 0;
    color: var(--setup-muted);
  }
}

.setup-spinner {
  width: 30px;
  height: 30px;
  flex: none;
  border: 3px solid #2fae6a40;
  border-top-color: #2fae6a;
  border-radius: 50%;
  animation: setup-spin 900ms linear infinite;

  &--small {
    width: 12px;
    height: 12px;
    border-width: 2px;
    border-color: #f07a2a40;
    border-top-color: var(--setup-accent);
  }
}

@keyframes setup-spin {
  to { transform: rotate(360deg); }
}

.setup-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;

  .cardbox {
    margin: 0;
  }
}

.setup-more {
  > summary {
    margin: 0;
    cursor: pointer;
    list-style: none;

    &::-webkit-details-marker {
      display: none;
    }
  }

  &[open] > summary {
    margin-bottom: 12px;
  }
}

.setup-more__ma {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 12px;
}

// The step-by-step choice (SelectInitialCards) in the colours of this page.
.setup-page {
  .setup-steps {
    background: linear-gradient(#120d0bf2 70%, transparent);
  }

  .setup-steps__tab {
    border-color: #ffffff2e;
    background: linear-gradient(#2a1a12, #140d0a);
    color: var(--setup-text);

    &:hover {
      border-color: var(--setup-accent);
    }

    &--current {
      border-color: var(--setup-gold);
      box-shadow: 0 0 0 1px var(--setup-gold), 0 0 16px #f3c46b44;
      color: #fff3c4;
    }
  }

  .setup-steps__number {
    background: var(--setup-accent);
    color: #fff;
  }

  .setup-steps__status {
    color: var(--setup-muted);
  }

  .setup-summary {
    border-color: var(--setup-accent);
    background: #140d0af7;
  }

  .corporation-selection {
    border-color: var(--setup-line);
    border-radius: 14px;
    background:
      linear-gradient(180deg, #0b0705c0, #120d0bf2),
      url(./assets/board/mars-orbit.jpg) center top / cover no-repeat,
      #1b0f09;
  }

  .corporation-selection__option {
    border-color: #ffffff2e;
    border-radius: 12px;
    background: linear-gradient(155deg, #2a1a12ec, #120d0bed);
  }

  .corporation-selection__option--selected {
    border-color: var(--setup-gold);
    box-shadow: 0 0 0 1px var(--setup-gold), 0 0 22px #f3c46b55;
  }

  .corporation-selection__choice {
    border-color: #ffffff3a;
    border-radius: 8px;
    background: #140d0a;

    &:focus-within,
    &:hover {
      border-color: var(--setup-accent);
    }

    &:has(:checked) {
      border-color: var(--setup-gold);
      background: #3a2410;
      color: #ffe2b0;
    }
  }
}

@media (max-width: 640px) {
  .setup-hero {
    padding: 20px 18px;
  }

  .setup-hero__dome {
    position: absolute;
    right: -20px;
    bottom: -10px;
    opacity: 0.45;
  }
}
</style>
