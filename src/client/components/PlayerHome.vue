<template>
  <div id="player-home" :class="{'with-turmoil': game.turmoil, 'mission-cinematic': cinematic}" @click="startMissionAudio" @keydown="startMissionAudio">
    <div v-if="game.phase === 'end'">
      <div class="player_home_block">
        <DynamicTitle title="This game is over!" :color="thisPlayer.color" />
        <a :href="'the-end?id='+ playerView.id" v-i18n>Go to game results</a>
      </div>
    </div>

    <button
      v-if="cinematic"
      type="button"
      class="mission-sound"
      :aria-label="$t('Enable sounds')"
      :title="$t('Enable sounds')"
      :aria-pressed="soundsEnabled"
      @click.stop="toggleMissionAudio">
      <span aria-hidden="true">♪</span>
    </button>
    <details class="mission-menu" :open="!cinematic" @click="routeSidebarLink">
      <summary :aria-label="$t('Player Settings')" :title="$t('Player Settings')">⚙</summary>
      <Sidebar
        :actingPlayer="isPlayerActing(playerView)"
        :playerColor="thisPlayer.color"
        :generation="game.generation"
        :coloniesCount="game.colonies.length"
        :temperature="game.temperature"
        :oxygen="game.oxygenLevel"
        :oceans="game.oceans"
        :venus="game.venusScaleLevel"
        :turmoil="game.turmoil"
        :moonData="game.moon"
        :gameOptions="game.gameOptions"
        :playerNumber="playerView.players.length"
        :lastSoloGeneration="game.lastSoloGeneration"
        :deckSize="game.deckSize"
        :discardPileSize="game.discardPileSize"
        :otherDeckSizes="game.otherDeckSizes" />
    </details>

    <header class="mission-status">
      <div>
        <p class="mission-status__generation">
          <span v-i18n>Generation</span> {{ game.generation }}<template v-if="playerView.players.length === 1"> / {{ game.lastSoloGeneration }}</template>
          <template v-if="game.phase === 'action' && game.turn !== undefined"> · <span v-i18n>Turn</span> {{ game.turn }}</template>
        </p>
        <div class="mission-status__title">
          <h1 :title="$t(game.gameOptions.boardName)"><span class="mission-status__brand" v-i18n>Terraforming Mars</span><span class="mission-status__board">{{ $t(game.gameOptions.boardName) }}</span></h1>
          <a v-if="game.phase !== 'end'" href="#actions" v-i18n>Actions</a>
        </div>
        <span v-if="activeTurnColor === thisPlayer.color" class="mission-status__your-turn" role="status" v-i18n>Your turn</span>
        <span v-if="game.isTerraformed" class="mission-status__complete" v-i18n>Terraforming complete</span>
      </div>
      <dl class="mission-status__metrics">
        <div v-for="metric in missionMetrics" :key="metric.key" class="mission-status__metric" :class="['mission-status__metric--' + metric.key, {'mission-status__metric--complete': metric.value >= metric.max}]">
          <dt v-i18n>{{ metric.label }}</dt>
          <dd>
            <span :key="metric.value" class="mission-status__value">{{ metric.value }}{{ metric.unit }}</span>
            <span class="mission-status__target">/ {{ metric.max }}{{ metric.unit }}</span>
            <span v-if="metric.value >= metric.max" class="mission-status__check" :aria-label="$t('Completed!')" role="img">✓</span>
            <progress
              :value="metric.value - metric.min"
              :max="metric.max - metric.min"
              :aria-label="$t(metric.label)"
              :aria-valuetext="`${metric.value}${metric.unit} / ${metric.max}${metric.unit}`"></progress>
          </dd>
        </div>
      </dl>
    </header>

    <div v-if="thisPlayer.tableau.length > 0" class="mission-play">
      <div class="mission-play__map player_home_block">
        <GameBoardView
          ref="gameBoardView"
          :game="game"
          :tileView="tileView"
          :players="playerView.players"
          :detailsTarget="cinematic ? '#mission-board-details' : undefined"
          atlas
          @toggleTileView="cycleTileView()"
        />
        <ActivityFeed v-if="cinematic" :viewModel="playerView" @spaceClicked="jumpToLogSpace" />
        <RivalPanel v-if="cinematic" :players="playerView.players" :playerColor="thisPlayer.color" :activeColor="activeTurnColor" />
        <div class="mission-dock">
          <button type="button" class="mission-dock__button" :aria-expanded="missionPanel === 'played'" @click="toggleMissionPanel('played')" v-i18n>Played Cards</button>
          <MissionPlayerHud
            :player="thisPlayer"
            :cards="allCardsInHand"
            :playableCards="cardAvailability.projects"
            :actionCards="cardAvailability.actions" />
          <div class="mission-dock__commands">
            <button type="button" class="mission-dock__button" :aria-expanded="missionPanel === 'details'" @click="toggleMissionPanel('details')" v-i18n>Game details</button>
            <button type="button" class="mission-dock__button mission-dock__button--primary" :aria-expanded="missionPanel === 'actions'" @click="toggleMissionPanel('actions')" v-i18n>Actions</button>
            <button v-if="endTurnIndex !== -1" type="button" class="mission-dock__button" @click="endTurn" v-i18n>End Turn</button>
          </div>
        </div>
      </div>
    </div>

    <template v-if="thisPlayer.tableau.length === 0">
      <PlayerSetupView :playerView="playerView" :tileView="tileView" @toggleTileView="cycleTileView()">
        <TopBar :playerView="playerView" />
      </PlayerSetupView>
    </template>

    <section v-show="!cinematic || missionPanel !== undefined" ref="missionPanelElement" class="mission-panel" tabindex="-1" :aria-label="$t('Game details')" @keydown.esc.stop="closeMissionPanel">
      <header v-if="cinematic" class="mission-panel__nav">
        <button v-for="panel in missionPanels" :key="panel.id" type="button" :aria-pressed="missionPanel === panel.id" @click="showMissionPanel(panel.id)">{{ $t(panel.label) }}</button>
        <button type="button" class="mission-panel__close" :aria-label="$t('Close')" @click="closeMissionPanel">×</button>
      </header>
      <div class="mission-panel__body" ref="missionPanelBody">
        <template v-if="thisPlayer.tableau.length > 0">
          <TopBar v-show="!cinematic || missionPanel === 'details'" :playerView="playerView" />
          <div class="mission-play__controls">
            <section v-if="game.phase !== 'end'" v-show="!cinematic || missionPanel === 'actions'" class="mission-play__actions player_home_block player_home_block--actions nofloat">
              <a name="actions" class="player_home_anchor hotkey-target"></a>
              <h2 v-i18n>Actions</h2>
              <WaitingFor ref="waitingFor" :playerView="playerView" :waitingfor="playerView.waitingFor" :requestId="playerView.requestId" />
            </section>
            <div v-show="!cinematic || missionPanel === 'hand'">
              <div class="player_home_block player_home_block--hand" v-if="playerView.draftedCards.length > 0">
                <DynamicTitle title="Drafted cards" :color="thisPlayer.color" />
                <div v-for="card in playerView.draftedCards" :key="card.name" class="cardbox">
                  <Card :card="card" />
                </div>
              </div>

              <a name="cards" class="player_home_anchor"></a>
              <div class="mission-play__hand player_home_block player_home_block--hand" v-if="cardsInHandCount > 0" id="shortkey-hand">
                <div class="hiding-card-button-row">
                  <DynamicTitle title="Cards In Hand" :color="thisPlayer.color" />
                  <button type="button" :class="getHideButtonClass('HAND')" :aria-expanded="isVisible('HAND')" @click="toggle('HAND')">
                    <span class="played-cards-count">{{ cardsInHandCount }}</span>
                    <span class="played-cards-selection" v-i18n>{{ getToggleLabel('HAND') }}</span>
                  </button>
                  <CardSortButtons v-model:sortOrder="handSortOrder" />
                </div>
                <SortableCards v-show="isVisible('HAND')" :playerId="playerView.id" :cards="allCardsInHand" v-model:sortOrder="handSortOrder" />
              </div>
            </div>
          </div>

          <a class="hotkey-target"></a>
          <PlayersOverview v-show="!cinematic || missionPanel === 'details'" class="player_home_block player_home_block--players nofloat" :playerView="playerView" id="shortkey-playersoverview" />

          <a class="hotkey-target"></a>
          <div v-show="!cinematic || missionPanel === 'log'" class="player_home_block nofloat">
            <LogPanel :viewModel="playerView" :step="game.step" @spaceClicked="jumpToLogSpace" />
          </div>

          <div v-show="!cinematic || missionPanel === 'played'" id="played-cards" class="player_home_block player_home_block--cards">
            <div class="hiding-card-button-row">
              <DynamicTitle title="Played Cards" :color="thisPlayer.color" />
              <div class="played-cards-filters">
                <div :class="getHideButtonClass('ACTIVE')" @click.prevent="toggle('ACTIVE')">
                  <div class="played-cards-count">{{ activeTableauCount }}</div>
                  <div class="played-cards-selection" v-i18n>{{ getToggleLabel('ACTIVE') }}</div>
                </div>
                <div :class="getHideButtonClass('AUTOMATED')" @click.prevent="toggle('AUTOMATED')">
                  <div class="played-cards-count">{{ automatedTableauCount }}</div>
                  <div class="played-cards-selection" v-i18n>{{ getToggleLabel('AUTOMATED') }}</div>
                </div>
                <div :class="getHideButtonClass('EVENT')" @click.prevent="toggle('EVENT')">
                  <div class="played-cards-count">{{ eventTableauCount }}</div>
                  <div class="played-cards-selection" v-i18n>{{ getToggleLabel('EVENT') }}</div>
                </div>
              </div>
              <div class="text-overview" v-i18n>[ toggle cards filters ]</div>
            </div>
            <div v-for="card in getCardsByType(thisPlayer.tableau, [CardType.CORPORATION])" :key="card.name" class="cardbox">
              <Card :card="card" :actionUsed="isCardActivated(card, thisPlayer)" :cubeColor="thisPlayer.color" :class="{'mission-card-available': cardAvailability.actions.has(card.name)}" autoTall />
              <span v-if="cardAvailability.actions.has(card.name)" class="mission-card-status" v-i18n>Action available</span>
            </div>
            <div v-for="card in getCardsByType(thisPlayer.tableau, [CardType.CEO])" :key="card.name" class="cardbox">
              <Card :card="card" :actionUsed="isCardActivated(card, thisPlayer)" :cubeColor="thisPlayer.color" :class="{'mission-card-available': cardAvailability.actions.has(card.name)}" autoTall />
              <span v-if="cardAvailability.actions.has(card.name)" class="mission-card-status" v-i18n>Action available</span>
            </div>
            <div v-show="isVisible('ACTIVE')" v-for="card in activeTableauCards" :key="card.name" class="cardbox">
              <Card :card="card" :actionUsed="isCardActivated(card, thisPlayer)" :cubeColor="thisPlayer.color" :class="{'mission-card-available': cardAvailability.actions.has(card.name)}" autoTall />
              <span v-if="cardAvailability.actions.has(card.name)" class="mission-card-status" v-i18n>Action available</span>
            </div>

            <StackedCards v-show="isVisible('AUTOMATED')" :cards="automatedTableauCards" :actionCards="cardAvailability.actions" />

            <StackedCards v-show="isVisible('EVENT')" :cards="eventTableauCards" :actionCards="cardAvailability.actions" />

          </div>

          <div v-if="thisPlayer.selfReplicatingRobotsCards.length > 0" v-show="!cinematic || missionPanel === 'played'" class="player_home_block">
            <DynamicTitle title="Self-replicating Robots cards" :color="thisPlayer.color" />
            <div>
              <div v-for="card in thisPlayer.selfReplicatingRobotsCards" :key="card.name" class="cardbox">
                <Card :card="card" />
              </div>
            </div>
          </div>
        </template>

        <div v-show="!cinematic || missionPanel === 'details'">
          <div id="mission-board-details"></div>
          <div v-if="thisPlayer.underworldData.tokens.length > 0">
            <DynamicTitle title="Claimed Underground Resource Tokens" :color="thisPlayer.color" />
            <UndergroundTokens :underworldData="thisPlayer.underworldData" />
          </div>

          <div v-if="game.colonies.length > 0" class="player_home_block" ref="colonies" id="shortkey-colonies">
            <a name="colonies" class="player_home_anchor hotkey-target"></a>
            <DynamicTitle title="Colonies" :color="thisPlayer.color" />
            <div class="colonies-fleets-cont">
              <div class="colonies-player-fleets" v-for="colonyPlayer in playerView.players" :key="colonyPlayer.color">
                <div :class="'colonies-fleet colonies-fleet-'+ colonyPlayer.color" v-for="idx in getFleetsCountRange(colonyPlayer)" :key="idx"></div>
              </div>
            </div>
            <div class="player_home_colony_cont">
              <div class="player_home_colony" v-for="colony in game.colonies" :key="colony.name">
                <Colony :colony="colony" :active="colony.isActive" />
              </div>
            </div>
          </div>

          <div>
            <a :href="'/spectator?id=' +game.spectatorId" target="_blank" rel="noopener noreferrer" v-i18n>Spectator link</a>
          </div>
          <PurgeWarning :expectedPurgeTimeMs="game.expectedPurgeTimeMs" />
        </div>
      </div>
    </section>
    <KeyboardShortcuts v-show="keyboardShortcutOpened" @close="keyboardShortcutOpened = false" />
  </div>
</template>

<script lang="ts">
import {defineComponent, onBeforeUnmount, onMounted, provide, shallowRef} from 'vue';

import Card from '@/client/components/card/Card.vue';
import PlayersOverview from '@/client/components/overview/PlayersOverview.vue';
import RivalPanel from '@/client/components/overview/RivalPanel.vue';
import {Color} from '@/common/Color';
import {Phase} from '@/common/Phase';
import WaitingFor from '@/client/components/WaitingFor.vue';
import Sidebar from '@/client/components/Sidebar.vue';
import Colony from '@/client/components/colonies/Colony.vue';
import LogPanel from '@/client/components/logpanel/LogPanel.vue';
import ActivityFeed from '@/client/components/logpanel/ActivityFeed.vue';
import GameBoardView from '@/client/components/GameBoardView.vue';
import PlayerSetupView from '@/client/components/PlayerSetupView.vue';
import DynamicTitle from '@/client/components/common/DynamicTitle.vue';
import SortableCards from '@/client/components/SortableCards.vue';
import CardSortButtons from '@/client/components/CardSortButtons.vue';
import {SortOrder} from '@/client/utils/SortOrder';
import TopBar from '@/client/components/TopBar.vue';
import StackedCards from '@/client/components/StackedCards.vue';
import PurgeWarning from '@/client/components/common/PurgeWarning.vue';
import UndergroundTokens from '@/client/components/underworld/UndergroundTokens.vue';
import KeyboardShortcuts from '@/client/components/KeyboardShortcuts.vue';
import {getPreferences, Preferences, PreferencesManager} from '@/client/utils/PreferencesManager';
import {GameModel} from '@/common/models/GameModel';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {CardType} from '@/common/cards/CardType';
import {getCardsByType, isCardActivated} from '@/client/utils/CardUtils';
import {sortActiveCards} from '@/client/utils/ActiveCardsSortingOrder';
import {CardModel} from '@/common/models/CardModel';
import {getCardOrThrow} from '../cards/ClientCardManifest';
import {HomeMixin} from '@/client/mixins/HomeMixin';
import {MAXIMUM_HABITAT_RATE, MAXIMUM_LOGISTIC_RATE, MAXIMUM_MINING_RATE, MIN_OXYGEN_LEVEL, MIN_TEMPERATURE, MIN_VENUS_SCALE} from '@/common/constants';
import {getGlobalParameterMaximums} from '@/common/boards/GlobalParameterMaximums';
import {mapPlacementKey} from '@/client/components/board/MapPlacement';
import MissionPlayerHud from '@/client/components/board/MissionPlayerHud.vue';
import {SelectSpaceModel} from '@/common/models/PlayerInputModel';
import {SoundManager} from '@/client/utils/SoundManager';
import {KeyboardNavigation} from '@/client/components/KeyboardNavigation';
import {SpaceId} from '@/common/Types';
import {getCardAvailability} from '@/client/utils/CardAvailability';

type PlayerHomeModel = {
  missionPanel: MissionPanel | undefined;
  missionPanelOpener: HTMLElement | undefined;
  missionAudioStarted: boolean;
  showHand: boolean;
  showActiveCards: boolean;
  showAutomatedCards: boolean;
  showEventCards: boolean;
  /** Current sort order of the hand, or undefined before the player picks one and after they reorder by hand. */
  handSortOrder: SortOrder | undefined;
}

type ToggleableCardType = 'HAND' | 'ACTIVE' | 'AUTOMATED' | 'EVENT';

const missionPanels = [
  {id: 'actions', label: 'Actions'},
  {id: 'played', label: 'Played Cards'},
  {id: 'hand', label: 'Cards In Hand'},
  {id: 'details', label: 'Game details'},
  {id: 'log', label: 'Game log'},
] as const;
type MissionPanel = typeof missionPanels[number]['id'];

const typeToDataModel: Record<ToggleableCardType, {key: 'showHand' | 'showActiveCards' | 'showAutomatedCards' | 'showEventCards', preference: keyof Preferences}> = {
  HAND: {key: 'showHand', preference: 'hide_hand'},
  ACTIVE: {key: 'showActiveCards', preference: 'hide_active_cards'},
  AUTOMATED: {key: 'showAutomatedCards', preference: 'hide_automated_cards'},
  EVENT: {key: 'showEventCards', preference: 'hide_event_cards'},
} as const;

export default defineComponent({
  name: 'PlayerHome',
  mixins: [HomeMixin],
  setup() {
    const mapPlacement = shallowRef<SelectSpaceModel>();
    provide(mapPlacementKey, {input: mapPlacement});
    let previousViewport: string | null = null;
    onMounted(() => {
      const viewport = document.querySelector('meta[name="viewport"]');
      previousViewport = viewport?.getAttribute('content') ?? null;
      viewport?.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');
    });
    onBeforeUnmount(() => {
      if (previousViewport !== null) {
        document.querySelector('meta[name="viewport"]')?.setAttribute('content', previousViewport);
      }
    });
    return {mapPlacement, missionPanels};
  },
  data(): PlayerHomeModel {
    const preferences = getPreferences();
    return {
      missionPanel: undefined,
      missionPanelOpener: undefined,
      missionAudioStarted: false,
      showHand: !preferences.hide_hand,
      showActiveCards: !preferences.hide_active_cards,
      showAutomatedCards: !preferences.hide_automated_cards,
      showEventCards: !preferences.hide_event_cards,
      handSortOrder: undefined,
    };
  },
  watch: {
    mapPlacement(input: SelectSpaceModel | undefined) {
      if (this.cinematic && input !== undefined) {
        this.missionPanel = input.spaces.some((space) => space.startsWith('m')) ? 'details' : undefined;
      }
    },
    cinematic: 'syncMissionAmbience',
    soundsEnabled: 'syncMissionAmbience',
    'game.generation'(generation: number, previous: number) {
      if (this.cinematic && generation > previous) {
        SoundManager.mission('turn');
      }
    },
    'thisPlayer.tableau.length'(count: number, previous: number) {
      if (previous === 0 && count > 0) {
        this.$nextTick(() => window.scrollTo({top: 0}));
      } else if (count > previous && this.cinematic) {
        SoundManager.mission('project');
      }
    },
    showHand: function hide_hand() {
      PreferencesManager.INSTANCE.set('hide_hand', !this.showHand);
    },
    showActiveCards: function toggle_active_cards() {
      PreferencesManager.INSTANCE.set('hide_active_cards', !this.showActiveCards);
    },
    showAutomatedCards: function toggle_automated_cards() {
      PreferencesManager.INSTANCE.set('hide_automated_cards', !this.showAutomatedCards);
    },
    showEventCards: function toggle_event_cards() {
      PreferencesManager.INSTANCE.set('hide_event_cards', !this.showEventCards);
    },
  },
  props: {
    playerView: {
      type: Object as () => PlayerViewModel,
      required: true,
    },
  },
  computed: {
    cardAvailability() {
      return getCardAvailability(this.playerView);
    },
    activeTurnColor(): Color | undefined {
      const {phase, passedPlayers} = this.game;
      if (phase !== Phase.ACTION && phase !== Phase.PRELUDES && phase !== Phase.CEOS) {
        return undefined;
      }
      return this.playerView.players.find((player) => player.isActive && (phase !== Phase.ACTION || !passedPlayers.includes(player.color)))?.color;
    },
    cinematic(): boolean {
      return this.thisPlayer.tableau.length > 0 && this.game.phase !== 'end';
    },
    soundsEnabled(): boolean {
      return getPreferences().enable_sounds;
    },
    endTurnIndex(): number {
      const input = this.playerView.waitingFor;
      if (input?.type !== 'or' || input.optional) {
        return -1;
      }
      return input.options.findIndex((option) => option.type === 'option' && option.title === 'End Turn');
    },
    missionMetrics() {
      const {temperature, oxygenLevel, oceans, gameOptions, moon, venusScaleLevel} = this.game;
      const max = getGlobalParameterMaximums(gameOptions.boardName);
      const solo = this.playerView.players.length === 1;
      const metrics = [
        {key: 'temperature', label: 'Temperature', value: temperature, unit: '°C', min: MIN_TEMPERATURE, max: max.temperature},
        {key: 'oxygen', label: 'Oxygen Level', value: oxygenLevel, unit: '%', min: MIN_OXYGEN_LEVEL, max: max.oxygen},
        {key: 'oceans', label: 'Oceans', value: oceans, unit: '', min: 0, max: max.oceans},
      ];
      if (gameOptions.expansions.venus && (solo || gameOptions.requiresVenusTrackCompletion)) {
        metrics.push({key: 'venus', label: 'Venus Scale', value: venusScaleLevel, unit: '%', min: MIN_VENUS_SCALE, max: max.venus});
      }
      if (moon !== undefined && gameOptions.requiresMoonTrackCompletion) {
        metrics.push(
          {key: 'habitat', label: 'Habitat Rate', value: moon.habitatRate, unit: '', min: 0, max: MAXIMUM_HABITAT_RATE},
          {key: 'mining', label: 'Mining Rate', value: moon.miningRate, unit: '', min: 0, max: MAXIMUM_MINING_RATE},
          {key: 'logistics', label: 'Logistics Rate', value: moon.logisticRate, unit: '', min: 0, max: MAXIMUM_LOGISTIC_RATE},
        );
      }
      if (solo && gameOptions.soloTR) {
        metrics.push({key: 'rating', label: 'Terraform Rating', value: this.thisPlayer.terraformRating, unit: '', min: 0, max: 63});
      }
      return metrics;
    },
    thisPlayer(): PublicPlayerModel {
      return this.playerView.thisPlayer;
    },
    game(): GameModel {
      return this.playerView.game;
    },
    CardType(): typeof CardType {
      return CardType;
    },
    cardsInHandCount(): number {
      const playerView = this.playerView;
      return playerView.cardsInHand.length + playerView.preludeCardsInHand.length + playerView.ceoCardsInHand.length;
    },
    allCardsInHand(): Array<CardModel> {
      const playerView = this.playerView;
      return playerView.preludeCardsInHand
        .concat(playerView.ceoCardsInHand)
        .concat(playerView.cardsInHand);
    },
    activeTableauCount(): number {
      return getCardsByType(this.thisPlayer.tableau, [CardType.ACTIVE]).length;
    },
    automatedTableauCount(): number {
      return getCardsByType(this.thisPlayer.tableau, [CardType.AUTOMATED, CardType.PRELUDE]).length;
    },
    eventTableauCount(): number {
      return getCardsByType(this.thisPlayer.tableau, [CardType.EVENT]).length;
    },
    activeTableauCards(): Array<CardModel> {
      const cards = getCardsByType(this.thisPlayer.tableau, [CardType.ACTIVE, CardType.PRELUDE]);
      return [...sortActiveCards(cards.filter((c) => this.isActive(c)))];
    },
    automatedTableauCards(): Array<CardModel> {
      const cards = getCardsByType(this.thisPlayer.tableau, [CardType.AUTOMATED, CardType.PRELUDE]);
      return cards.filter((c) => this.isNotActive(c));
    },
    eventTableauCards(): Array<CardModel> {
      return [...getCardsByType(this.thisPlayer.tableau, [CardType.EVENT])];
    },
    getCardsByType(): typeof getCardsByType {
      return getCardsByType;
    },
    isCardActivated(): typeof isCardActivated {
      return isCardActivated;
    },
    sortActiveCards(): typeof sortActiveCards {
      return sortActiveCards;
    },
  },

  components: {
    MissionPlayerHud,
    DynamicTitle,
    Card,
    PlayersOverview,
    RivalPanel,
    WaitingFor,
    Sidebar,
    Colony,
    LogPanel,
    ActivityFeed,
    SortableCards,
    CardSortButtons,
    TopBar,
    GameBoardView,
    PlayerSetupView,
    StackedCards,
    PurgeWarning,
    UndergroundTokens,
    KeyboardShortcuts,
  },
  mounted() {
    document.addEventListener('visibilitychange', this.syncMissionAmbience);
  },
  beforeUnmount() {
    document.removeEventListener('visibilitychange', this.syncMissionAmbience);
    SoundManager.stopMissionAmbience();
  },
  methods: {
    showMissionPanel(panel: MissionPanel) {
      if (this.cinematic && this.missionPanel === undefined && document.activeElement instanceof HTMLElement) {
        this.missionPanelOpener = document.activeElement;
        this.$nextTick(() => {
          (this.$refs.missionPanelElement as HTMLElement | undefined)?.focus({preventScroll: true});
        });
      }
      this.missionPanel = panel;
      const body = this.$refs.missionPanelBody as HTMLElement | undefined;
      if (body !== undefined) {
        body.scrollTop = 0;
      }
    },
    toggleMissionPanel(panel: MissionPanel) {
      if (this.missionPanel === panel) {
        this.closeMissionPanel();
      } else {
        this.showMissionPanel(panel);
      }
    },
    closeMissionPanel() {
      this.missionPanel = undefined;
      this.missionPanelOpener?.focus({preventScroll: true});
      this.missionPanelOpener = undefined;
    },
    routeSidebarLink(event: MouseEvent) {
      if (!this.cinematic || !(event.target instanceof Element)) {
        return;
      }
      const href = event.target.closest('a')?.getAttribute('href');
      switch (href) {
      case '#actions':
        this.showMissionPanel('actions');
        break;
      case '#cards':
        this.showMissionPanel('hand');
        break;
      case '#colonies':
        this.showMissionPanel('details');
        break;
      case '#board':
        this.closeMissionPanel();
        break;
      default:
        return;
      }
      event.preventDefault();
    },
    handleViewNavigation(event: KeyboardEvent): boolean {
      if (!this.cinematic || (event.target instanceof HTMLElement && event.target.matches('input, textarea, select, [contenteditable="true"]'))) {
        return false;
      }
      switch (event.code) {
      case KeyboardNavigation.GAMEBOARD:
        this.closeMissionPanel();
        break;
      case KeyboardNavigation.PLAYERSOVERVIEW:
      case KeyboardNavigation.COLONIES:
        this.showMissionPanel('details');
        break;
      case KeyboardNavigation.HAND:
        this.showMissionPanel('hand');
        break;
      default:
        return false;
      }
      event.preventDefault();
      return true;
    },
    jumpToLogSpace(space: SpaceId) {
      if (this.cinematic) {
        this.missionPanel = space.startsWith('m') ? 'details' : undefined;
      }
      this.$nextTick(() => this.onSpaceClicked(space));
    },
    startMissionAudio() {
      if (this.cinematic && this.soundsEnabled && !this.missionAudioStarted) {
        this.missionAudioStarted = true;
        this.syncMissionAmbience();
      }
    },
    syncMissionAmbience() {
      if (this.missionAudioStarted && this.cinematic && this.soundsEnabled && !document.hidden) {
        SoundManager.startMissionAmbience();
      } else {
        SoundManager.stopMissionAmbience();
      }
    },
    toggleMissionAudio() {
      PreferencesManager.INSTANCE.set('enable_sounds', !this.soundsEnabled);
      this.startMissionAudio();
      this.syncMissionAmbience();
    },
    endTurn() {
      if (this.endTurnIndex !== -1) {
        (this.$refs.waitingFor as InstanceType<typeof WaitingFor> | undefined)?.onsave({
          type: 'or', index: this.endTurnIndex, response: {type: 'option'},
        });
      }
    },
    isPlayerActing(playerView: PlayerViewModel) : boolean {
      return playerView.players.length > 1 && playerView.waitingFor !== undefined && !playerView.waitingFor.optional;
    },
    getFleetsCountRange(player: PublicPlayerModel): Array<number> {
      const fleetsRange = [];
      for (let i = 0; i < player.fleetSize - player.tradesThisGeneration; i++) {
        fleetsRange.push(i);
      }
      return fleetsRange;
    },
    toggle(type: ToggleableCardType): void {
      this[typeToDataModel[type].key] = !this[typeToDataModel[type].key];
    },
    isVisible(type: ToggleableCardType): boolean {
      return this[typeToDataModel[type].key];
    },
    getToggleLabel(hideType: ToggleableCardType): string {
      const val = this[typeToDataModel[hideType].key];
      return val ? '✔' : '';
    },
    getHideButtonClass(hideType: ToggleableCardType): string {
      const prefix = 'hiding-card-button ';
      switch (hideType) {
      case 'HAND':
        return prefix + (this.showHand ? 'hand-toggle' : 'hand-toggle-transparent');
      case 'ACTIVE':
        return prefix + (this.showActiveCards ? 'active' : 'active-transparent');
      case 'AUTOMATED':
        return prefix + (this.showAutomatedCards ? 'automated' : 'automated-transparent');
      case 'EVENT':
        return prefix + (this.showEventCards ? 'event' : 'event-transparent');
      }
    },
    isActive(cardModel: CardModel): boolean {
      const card = getCardOrThrow(cardModel.name);
      return card.type === CardType.ACTIVE || card.hasAction;
    },
    isNotActive(cardModel: CardModel): boolean {
      return !getCardOrThrow(cardModel.name).hasAction;
    },
  },
});

</script>
