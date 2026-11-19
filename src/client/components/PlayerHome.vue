<template>
  <div id="player-home" :class="{'with-turmoil': game.turmoil, 'mission-cinematic': cinematic, 'mission-setup-mode': setupMode, 'mission-placing': cinematic && mapPlacement !== undefined}" @click="startMissionAudio" @keydown="startMissionAudio">
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
    <MissionSettings v-if="cinematic || setupMode" />
    <Sidebar v-else-if="!setupMode"
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


    <header v-if="!setupMode" class="mission-status">
      <div>
        <p class="mission-status__generation">
          <span class="mission-status__generation-label" v-i18n>Generation</span>
          <strong>{{ game.generation }}<template v-if="playerView.players.length === 1"> / {{ game.lastSoloGeneration }}</template></strong>
          <small v-if="game.phase === 'action' && game.turn !== undefined"> · <span v-i18n>Turn</span> {{ game.turn }}</small>
        </p>
        <div class="mission-status__title">
          <h1 :title="$t(game.gameOptions.boardName)">
            <span class="mission-status__board">{{ $t(game.gameOptions.boardName) }}</span>
          </h1>
          <a v-if="game.phase !== 'end'" href="#actions" v-i18n>Actions</a>
        </div>
        <span v-if="game.isTerraformed" class="mission-status__complete" v-i18n>Terraforming complete</span>
      </div>
      <dl class="mission-status__metrics" :class="{'mission-status__metrics--extended': missionMetrics.length > 3}">
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
        <MissionUndoTurn v-if="cinematic" ref="undoTurn" :viewModel="playerView" />
        <ActivityFeed v-if="cinematic" :viewModel="playerView" @spaceClicked="jumpToLogSpace" @triggers="showEffectBadges" @cardPlays="showCardPlays" />
        <MissionEffectBadges v-if="cinematic" ref="effectBadges" :playerName="(color) => playerView.players.find((player) => player.color === color)?.name ?? color"
          @shown="(card, player) => player === thisPlayer.color && lightEffect(card)" />
        <RivalPanel v-if="cinematic" :players="playerView.players" :playerColor="thisPlayer.color" :playerId="playerView.id" :activeColor="activeTurnColor" :passedColors="game.phase === 'action' ? game.passedPlayers : []" />
        <MissionPlayersPanel v-if="cinematic" ref="playersPanel" :key="`${playerView.id}:${playerView.runId}:${game.undoCount}`"
          :players="playerView.players" :activeColor="activeTurnColor" :myColor="thisPlayer.color" :playerId="playerView.id" :turmoil="game.turmoil" @open="showPlayerCards" />
        <!-- Right column: global parameters, then the turn button right under them. -->
        <div v-if="cinematic" class="mission-right-column">
          <MissionParameters :game="game" :solo="playerView.players.length === 1">
            <button type="button" class="mission-hud-ma" :class="{lit: hudMenusState.awards}" @click="hudShow('awards')"><span aria-hidden="true">🏆</span>{{ $t('Awards') }}</button>
            <button type="button" class="mission-hud-ma" :class="{lit: hudMenusState.milestones}" @click="hudShow('milestones')"><span aria-hidden="true">🏅</span>{{ $t('Milestones') }}</button>
            <MissionColonies ref="coloniesWindow" :colonies="game.colonies" :players="playerView.players" :trade-input="colonyTradeInput" @trade="tradeWithColony" />
            <button type="button" :aria-expanded="missionPanel === 'details'" @click="toggleMissionPanel('details')">{{ $t('Game details') }}</button>
            <button type="button" :aria-expanded="missionPanel === 'log'" @click="toggleMissionPanel('log')">{{ $t('Game log') }}</button>
            <button type="button" class="primary" :aria-expanded="missionPanel === 'actions'" @click="openActions">{{ $t(finalGreenery ? 'Final greenery placement' : 'Actions') }}</button>
            <button type="button" class="mission-pause-button" :disabled="pausing" @click="setPaused(true)"><span aria-hidden="true">⏸</span>{{ $t('Pause the game') }}</button>
            <button v-if="game.phase === 'action'" type="button" @click="askUndoTurn"><span aria-hidden="true">⟲</span>{{ $t('Undo turn') }}</button>
          </MissionParameters>
          <MissionTurnButton v-if="!mapPlacement" :actions="quickActions" :cardActions="cardActions?.cards ?? []"
            :canPass="passIndex !== -1" :canEndTurn="endTurnIndex !== -1" :active="activeTurnColor === thisPlayer.color && playerView.waitingFor !== undefined"
            :requestId="playerView.requestId" :deadline="thisPlayer.turnDeadline" :actionsTaken="thisPlayer.actionsTakenThisRound" :noActionLimit="othersPassed" :soloGame="playerView.players.length === 1" @select="openQuickAction" @cardAction="(card) => stageCardAction(card)" @pass="passNow" @endTurn="endTurn" />
        </div>
        <button v-if="pendingDecision" type="button" class="mission-pending-decision" @click="showMissionPanel('actions')">
          <span class="mission-pending-decision__icon" aria-hidden="true">!</span>
          <span>{{ $t('A decision is waiting') }}: <b>{{ pendingDecisionTitle }}</b></span>
          <span class="mission-pending-decision__open" v-i18n>Open</span>
        </button>
        <MissionDraftWaiting v-if="cinematic && (draftLockedIn || researchLockedIn)" :players="playerView.players" :deadline="game.draftDeadline"
          :stage="draftLockedIn ? 'draft' : 'research'" />
        <ConfirmDialog v-if="cinematic" ref="heatConfirm" message="Spend 8 heat to raise the temperature 1 step?" @accept="convertHeatNow" />
        <MissionStandardProjects v-if="cinematic && !mapPlacement" :actions="quickActions" :allProjects="game.standardProjects" @select="openQuickAction" />
        <div class="mission-dock">
          <MissionHudMenus ref="hudMenus" :playerView="playerView" :actions="quickActions" :actionCards="cardActions?.cards" @project="openQuickAction" @respond="respondToMenu" @cardAction="useCardActionNow" @playCard="(card) => previewProject(card)" />
          <MissionPlayerHud
            :player="thisPlayer"
            :cards="handCards"
            :playableCards="cardAvailability.projects"
            :actionCards="cardAvailability.actions"
            :conversions="conversions" @convert="openQuickAction"
            :inspected="previewedProject?.name" @preview="previewProject" @play="dropProject">
            <template #afterStocks>
              <button type="button" class="mission-dock__played" @click="showPlayerCards(thisPlayer.color)">
                <img src="assets/resources/card.png" alt=""><span>{{ $t('Played Cards') }}</span>
              </button>
              <button v-if="cardActions" type="button" class="mission-dock__played mission-dock__played--actions" @click="hudShow('actions')">
                <span class="mission-dock__count">{{ cardActions.cards.length }}</span><span>{{ $t('Card actions') }}</span>
              </button>
              <MissionEffectsBar :tableau="thisPlayer.tableau" :lit="litEffects" :usable="new Set(cardActions?.cards.map((card) => card.name) ?? [])" @use="useCardActionNow" @openAll="showPlayerCards(thisPlayer.color)" />
            </template>
          </MissionPlayerHud>
        </div>
      </div>
    </div>

    <MissionCardStage v-if="cinematic && stagedAction" :key="'action:' + stagedAction.name"
      :card="stagedAction" :input="undefined" :playerView="playerView" :origin="projectOrigin" useAction
      @close="stagedAction = undefined" @use="useCardAction" />

    <MissionCardStage v-if="cinematic && previewedProject" :key="previewedProject.name + (projectAutoPlay ? ':drop' : '')"
      :card="previewedProject" :input="projectOption?.input" :playerView="playerView" :origin="projectOrigin" :autoPlay="projectAutoPlay"
      @close="closeProjectPreview" @play="playPreviewedProject" />

    <MissionCardZoom v-if="cinematic || setupMode" :playerView="playerView" />
    <MissionPauseOverlay v-if="cinematic || setupMode" :paused="game.paused" :players="playerView.players" :busy="pausing" @resume="setPaused(false)" />

    <template v-if="thisPlayer.tableau.length === 0">
      <PlayerSetupView :playerView="playerView" :tileView="tileView" @toggleTileView="cycleTileView()" />
    </template>

    <SelectSpace v-if="mapPlacementInput" :key="playerView.requestId" :playerView="playerView" :playerinput="mapPlacementInput"
      :onsave="placeTile" :showsave="true" :showtitle="false" />

    <section v-show="!setupMode && (!cinematic || missionPanel !== undefined)" ref="missionPanelElement" class="mission-panel" :class="{'mission-panel--decision': decisionMode}" tabindex="-1" :aria-label="$t('Game details')" @keydown.esc.stop="closeMissionPanel">
      <header v-if="cinematic && !decisionMode" class="mission-panel__nav">
        <strong v-if="missionPanelLabel">{{ $t(missionPanelLabel) }}</strong>
      </header>
      <div class="mission-panel__body" ref="missionPanelBody">
        <DecisionHeading v-if="decisionMode && missionPanelLabel" class="mission-panel__decision-heading"
          :title="missionPanelLabel" closable @close="closeMissionPanel" />
        <div v-if="finalGreenery && missionPanel === 'actions'" class="mission-final-greenery">
          <AppButton type="submit" :title="finalGreenery.placement.title" @click="chooseFinalGreenery" />
          <AppButton :title="'Don\'t place a greenery'" @click="skipFinalGreenery" />
        </div>
        <template v-if="thisPlayer.tableau.length > 0">
          <TopBar v-show="!cinematic || missionPanel === 'details'" :playerView="playerView" />
          <div class="mission-play__controls">
            <section v-if="game.phase !== 'end'" v-show="!cinematic || missionPanel === 'actions'" class="mission-play__actions player_home_block player_home_block--actions nofloat">
              <a name="actions" class="player_home_anchor hotkey-target"></a>
              <WaitingFor ref="waitingFor" :playerView="playerView" :waitingfor="playerView.waitingFor" :hideInput="hideWaitingInput"
                :centerDeckChoice="cinematic" :requestId="playerView.requestId" />
              <template v-if="quickInput && quickAction">
                <SelectProjectCardToPlay v-if="quickInput.type === 'projectCard' && quickAction.card" :key="quickAction.id"
                  :playerView="playerView" :playerinput="quickInput" :selectedCard="quickAction.card" :onsave="submitQuickAction" showsave />
                <PlayerInputFactory v-else :key="quickAction.id" :playerView="playerView" :playerinput="quickInput"
                  :onsave="submitQuickAction" :showsave="true" :showtitle="true" />
              </template>
            </section>
            <section v-if="cinematic && missionPanel === 'projects'" class="player_home_block">
              <h2 v-i18n>Standard Projects</h2>
              <SelectProjectCardToPlay v-if="standardProjectInput" :key="playerView.requestId" :playerView="playerView"
                :playerinput="standardProjectInput" :onsave="playStandardProject" compactPayment showsave />
              <p v-else v-i18n>Standard projects are available when you can take an action.</p>
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
          <details v-if="cinematic && missionPanel === 'details'" @toggle="gameSetupOpen = ($event.target as HTMLDetailsElement).open">
            <summary v-i18n>Game Setup Details</summary>
            <InfoPanel v-if="gameSetupOpen" embedded :gameOptions="game.gameOptions" :playerNumber="playerView.players.length"
              :lastSoloGeneration="game.lastSoloGeneration" :deckSize="game.deckSize" :discardPileSize="game.discardPileSize" :otherDeckSizes="game.otherDeckSizes" />
          </details>
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
      <footer v-if="cinematic" class="mission-window-footer">
        <button type="button" class="mission-close" @click="closeMissionPanel" v-i18n>Close</button>
      </footer>
    </section>
    <KeyboardShortcuts v-show="keyboardShortcutOpened" @close="keyboardShortcutOpened = false" />
  </div>
</template>

<script lang="ts">
import {computed, defineComponent, onBeforeUnmount, onMounted, provide, shallowRef} from 'vue';

import Card from '@/client/components/card/Card.vue';
import PlayersOverview from '@/client/components/overview/PlayersOverview.vue';
import RivalPanel from '@/client/components/overview/RivalPanel.vue';
import {Color} from '@/common/Color';
import {Phase} from '@/common/Phase';
import WaitingFor from '@/client/components/WaitingFor.vue';
import DecisionHeading from '@/client/components/board/DecisionHeading.vue';
import Sidebar from '@/client/components/Sidebar.vue';
import MissionSettings from '@/client/components/MissionSettings.vue';
import MissionColonies from '@/client/components/board/MissionColonies.vue';
import InfoPanel from '@/client/components/InfoPanel.vue';
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
import {PlayerInputModel, SelectProjectCardToPlayModel, SelectSpaceModel} from '@/common/models/PlayerInputModel';
import SelectProjectCardToPlay from '@/client/components/SelectProjectCardToPlay.vue';
import SelectSpace from '@/client/components/SelectSpace.vue';
import AppButton from '@/client/components/common/AppButton.vue';
import MissionTurnButton from '@/client/components/board/MissionTurnButton.vue';
import MissionStandardProjects from '@/client/components/board/MissionStandardProjects.vue';
import MissionHudMenus from '@/client/components/board/MissionHudMenus.vue';
import ConfirmDialog from '@/client/components/common/ConfirmDialog.vue';
import MissionDraftWaiting from '@/client/components/board/MissionDraftWaiting.vue';
import {paths} from '@/common/app/paths';
import {vueRoot} from '@/client/components/vueRoot';
import MissionPauseOverlay from '@/client/components/board/MissionPauseOverlay.vue';
import MissionCardZoom from '@/client/components/board/MissionCardZoom.vue';
import {translateMessage, translateText} from '@/client/directives/i18n';
import MissionEffectBadges from '@/client/components/board/MissionEffectBadges.vue';
import MissionEffectsBar from '@/client/components/board/MissionEffectsBar.vue';
import {CardName} from '@/common/cards/CardName';
import MissionParameters from '@/client/components/board/MissionParameters.vue';
import MissionUndoTurn from '@/client/components/board/MissionUndoTurn.vue';
import MissionPlayersPanel from '@/client/components/board/MissionPlayersPanel.vue';
import {PlayedCardLogModel} from '@/common/models/PlayedCardLogModel';
import {actionMenu, cardActionOption, getMissionQuickActions, MaxedParameters, MissionQuickAction, passOptionIndex, showsCards} from '@/client/components/board/MissionQuickAction';
import MissionCardStage from '@/client/components/board/MissionCardStage.vue';
import {SoundManager} from '@/client/utils/SoundManager';
import {KeyboardNavigation} from '@/client/components/KeyboardNavigation';
import {SpaceId} from '@/common/Types';
import {getCardAvailability} from '@/client/utils/CardAvailability';
import {InputResponse, SelectProjectCardToPlayResponse, SelectSpaceResponse} from '@/common/inputs/InputResponse';

type PlayerHomeModel = {
  quickAction: MissionQuickAction | undefined;
  choosingFinalGreenery: boolean;
  pendingGreenery: {input: SelectSpaceModel; path: number[]; payment: SelectProjectCardToPlayResponse} | undefined;
  /** A space chosen on the map for an option of the action menu (e.g. plants to greenery), nothing sent yet. */
  pendingSpace: {input: SelectSpaceModel; index: number} | undefined;
  /** A pause or resume request is on its way. */
  pausing: boolean;
  /** Played effect cards glowing because their effect just gave something. */
  litEffects: ReadonlySet<CardName>;
  /** Menu index of the heat conversion waiting for confirmation. */
  pendingHeat: number | undefined;
  /** A played card lifted from the action rail, waiting for "Use action". */
  stagedAction: CardModel | undefined;
  previewedProject: CardModel | undefined;
  projectOrigin: DOMRect | undefined;
  projectAutoPlay: boolean;
  missionPanel: MissionPanel | undefined;
  missionPanelOpener: HTMLElement | undefined;
  gameSetupOpen: boolean;
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
  {id: 'projects', label: 'Standard Projects'},
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
  // Every card shown during the game (hand, windows, choices) wears the same skin.
  provide() {
    return {
      missionCards: computed(() => this.cinematic),
      missionDecisionPanel: computed(() => this.decisionMode),
      closeMissionPanel: this.closeMissionPanel,
    };
  },
  setup(props) {
    const placementContext = shallowRef<{input: SelectSpaceModel; view: PlayerViewModel}>();
    const mapPlacement = computed(() => {
      const placement = placementContext.value;
      return placement?.view === props.playerView ? placement.input : undefined;
    });
    function register(input: SelectSpaceModel) {
      const placement = {input, view: props.playerView};
      placementContext.value = placement;
      return () => {
        if (placementContext.value === placement) {
          placementContext.value = undefined;
        }
      };
    }
    const cancelMapChoice = shallowRef<() => void>();
    const requestCancel = shallowRef<(() => void)>();
    provide(mapPlacementKey, {input: mapPlacement, register, cancel: cancelMapChoice, requestCancel});
    provide('missionCompactProjectPayment', computed(() => props.playerView.thisPlayer.tableau.length > 0 && props.playerView.game.phase !== 'end'));
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
    return {mapPlacement, cancelMapChoice, requestCancel};
  },
  data(): PlayerHomeModel {
    const preferences = getPreferences();
    return {
      quickAction: undefined,
      choosingFinalGreenery: false,
      pendingGreenery: undefined,
      pendingSpace: undefined,
      stagedAction: undefined,
      pendingHeat: undefined,
      litEffects: new Set(),
      pausing: false,
      previewedProject: undefined,
      projectOrigin: undefined,
      projectAutoPlay: false,
      missionPanel: undefined,
      missionPanelOpener: undefined,
      gameSetupOpen: false,
      missionAudioStarted: false,
      showHand: !preferences.hide_hand,
      showActiveCards: !preferences.hide_active_cards,
      showAutomatedCards: !preferences.hide_automated_cards,
      showEventCards: !preferences.hide_event_cards,
      handSortOrder: undefined,
    };
  },
  watch: {
    // Own choice in, the others still choosing: the waiting notice in the middle, no empty actions window.
    waitingForOthers(waiting: boolean) {
      if (waiting && this.missionPanel === 'actions') {
        this.closeMissionPanel();
      }
    },
    canCancelPlacement: {
      immediate: true,
      handler(canCancel: boolean) {
        this.requestCancel = canCancel ? this.cancelPlacement : undefined;
      },
    },
    'playerView.requestId'() {
      const wasChoosingFinalGreenery = this.choosingFinalGreenery;
      const input = this.playerView.waitingFor;
      this.pendingGreenery = undefined;
      this.pendingSpace = undefined;
      this.choosingFinalGreenery = false;
      if (this.quickAction || (this.cinematic && this.missionPanel === 'actions' &&
        (input === undefined || actionMenu(input) !== undefined || input.type === 'space' || showsCards(input)))) {
        this.closeMissionPanel();
      }
      this.stagedAction = undefined;
      this.closeProjectPreview();
      if (this.game.phase === Phase.PRODUCTION && !this.playerView.waitingFor && (wasChoosingFinalGreenery || this.missionPanel === 'actions')) {
        this.closeMissionPanel();
      }
      this.showFollowUpDecision();
      if (this.missionPanel === 'projects' && this.standardProjectInput === undefined && this.playerView.waitingFor !== undefined) {
        this.showMissionPanel('actions');
      }
    },
    missionPanel() {
      this.gameSetupOpen = false;
    },
    mapPlacement(input: SelectSpaceModel | undefined) {
      if (this.cinematic && input !== undefined) {
        this.missionPanel = input.spaces.some((space) => space.startsWith('m')) ? 'details' : undefined;
      }
    },
    cinematic: 'syncMissionAmbience',
    soundsEnabled: 'syncMissionAmbience',
    musicEnabled: 'syncMissionAmbience',
    musicVolume: SoundManager.setMissionMusicVolume,
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
    missionPanelLabel(): string | undefined {
      if (this.finalGreenery && this.missionPanel === 'actions') {
        return 'Final greenery placement';
      }
      if (this.decisionMode) {
        return 'Your decision';
      }
      return this.quickAction?.label ?? missionPanels.find((panel) => panel.id === this.missionPanel)?.label;
    },
    quickActions(): MissionQuickAction[] {
      return this.activeTurnColor === this.thisPlayer.color ? getMissionQuickActions(this.playerView.waitingFor, this.maxedParameters) : [];
    },
    colonyTradeIndex(): number {
      const options = actionMenu(this.playerView.waitingFor)?.options;
      return options?.findIndex((option) => option.type === 'and' && option.title === 'Trade with a colony tile') ?? -1;
    },
    /** "Trade with a colony tile" (how to pay, which colony) when the player can trade now. */
    colonyTradeInput(): PlayerInputModel | undefined {
      return this.canTradeColonies ? actionMenu(this.playerView.waitingFor)?.options[this.colonyTradeIndex] : undefined;
    },
    canTradeColonies(): boolean {
      return this.activeTurnColor === this.thisPlayer.color && !this.mapPlacement && this.colonyTradeIndex !== -1;
    },
    quickInput(): PlayerInputModel | undefined {
      const input = this.playerView.waitingFor;
      const action = this.quickAction;
      return action && input?.type === 'or' && (action.id.startsWith('menu:') || this.quickActions.some(({id, index}) => id === action.id && index === action.index)) ? input.options[action.index] : undefined;
    },
    canCancelPlacement(): boolean {
      return this.choosingFinalGreenery || this.pendingGreenery !== undefined || this.pendingSpace !== undefined || this.cancelMapChoice !== undefined || this.quickInput?.type === 'space' ||
        (this.serverPlacement !== undefined && this.playerView.canCancelPlacement === true);
    },
    mapPlacementInput(): SelectSpaceModel | undefined {
      return (this.choosingFinalGreenery ? this.finalGreenery?.placement : undefined) ?? this.pendingGreenery?.input ?? this.pendingSpace?.input ?? this.serverPlacement;
    },
    finalGreenery(): {placement: SelectSpaceModel; placeIndex: number; skipIndex: number} | undefined {
      const input = this.playerView.waitingFor;
      if (!this.cinematic || this.game.phase !== Phase.PRODUCTION || input?.type !== 'or' || input.title !== 'Place any final greenery from plants') {
        return undefined;
      }
      const placeIndex = input.options.findIndex((option) => option.type === 'space');
      const skipIndex = input.options.findIndex((option) => option.type === 'option' && option.title === 'Don\'t place a greenery');
      const placement = input.options[placeIndex];
      return placement?.type === 'space' && skipIndex !== -1 ? {placement, placeIndex, skipIndex} : undefined;
    },
    serverPlacement(): SelectSpaceModel | undefined {
      const input = this.playerView.waitingFor;
      return this.cinematic && input?.type === 'space' ? input : undefined;
    },
    hideWaitingInput(): boolean {
      return this.quickInput !== undefined || this.serverPlacement !== undefined || this.finalGreenery !== undefined ||
        (this.cinematic && this.missionPanel !== 'actions' && actionMenu(this.playerView.waitingFor) !== undefined);
    },
    projectOption(): {input: SelectProjectCardToPlayModel; path: number[]} | undefined {
      const name = this.previewedProject?.name;
      if (name === undefined || !this.cardAvailability.projects.has(name)) {
        return undefined;
      }
      function find(input: PlayerInputModel | undefined, path: number[]): {input: SelectProjectCardToPlayModel; path: number[]} | undefined {
        if (input?.type === 'projectCard' && !input.optional && input.cards.some((card) => card.name === name && !card.isDisabled)) {
          return {input, path};
        }
        if (input?.type === 'or' && !input.optional) {
          for (const [index, option] of input.options.entries()) {
            const found = find(option, [...path, index]);
            if (found) {
              return found;
            }
          }
        }
        return undefined;
      }
      return find(this.playerView.waitingFor, []);
    },
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
    /** Before the first generation: the setup page alone, without the game screen around it. */
    setupMode(): boolean {
      return this.thisPlayer.tableau.length === 0 && this.game.phase !== 'end';
    },
    cinematic(): boolean {
      return this.thisPlayer.tableau.length > 0 && this.game.phase !== 'end';
    },
    hideAwardsAndMilestones(): boolean {
      return getPreferences().hide_awards_and_milestones;
    },
    musicEnabled(): boolean {
      return getPreferences().enable_music;
    },
    soundsEnabled(): boolean {
      return getPreferences().enable_sounds;
    },
    musicVolume(): number {
      return getPreferences().music_volume;
    },
    handCards(): ReadonlyArray<CardModel> {
      return this.allCardsInHand;
    },
    cardActions(): {index: number, cards: ReadonlyArray<CardModel>} | undefined {
      const option = this.activeTurnColor === this.thisPlayer.color ? cardActionOption(this.playerView.waitingFor) : undefined;
      return option && option.cards.length > 0 ? option : undefined;
    },
    /** A choice that follows an action: shown as a compact bar above the hand instead of the side window. */
    /** The game waits for a choice (not the action menu, a space or cards) and its window is closed. */
    pendingDecision(): boolean {
      const input = this.playerView.waitingFor;
      return this.cinematic && input !== undefined && this.missionPanel === undefined && this.mapPlacement === undefined &&
        actionMenu(input) === undefined && input.type !== 'space' && !showsCards(input) &&
        this.previewedProject === undefined && this.stagedAction === undefined;
    },
    pendingDecisionTitle(): string {
      const title = this.playerView.waitingFor?.title;
      if (title === undefined) {
        return '';
      }
      return typeof title === 'string' ? translateText(title) : translateMessage(title);
    },
    decisionMode(): boolean {
      const input = this.playerView.waitingFor;
      if (!this.cinematic || this.missionPanel !== 'actions') {
        return false;
      }
      return this.quickAction !== undefined || (input !== undefined && actionMenu(input) === undefined);
    },
    /** This player has picked a draft card and others are still choosing. */
    /** Cards bought in the research phase, the others still buying. */
    waitingForOthers(): boolean {
      return this.draftLockedIn || this.researchLockedIn;
    },
    researchLockedIn(): boolean {
      return this.game.phase === Phase.RESEARCH && this.playerView.waitingFor === undefined && this.thisPlayer.needsToResearch === false &&
        this.playerView.players.some((player) => player.needsToResearch === true);
    },
    draftLockedIn(): boolean {
      return this.thisPlayer.needsToDraft === false && this.playerView.players.some((player) => player.needsToDraft === true);
    },
    /** Everyone else has passed (always true in solo): no limit of two actions per turn. */
    othersPassed(): boolean {
      return this.playerView.players.every((player) => player.color === this.thisPlayer.color || this.game.passedPlayers.includes(player.color));
    },
    hudMenusState(): {awards: boolean, milestones: boolean} {
      const menu = actionMenu(this.playerView.waitingFor);
      const has = (prefix: string) => menu?.options.some((option) => option.type === 'or' && (typeof option.title === 'string' ? option.title : option.title.message).startsWith(prefix)) ?? false;
      return {awards: has('Fund an award'), milestones: has('Claim a milestone')};
    },
    activeTurnName(): string | undefined {
      return this.playerView.players.find((player) => player.color === this.activeTurnColor)?.name;
    },
    /** Global parameters at their maximum: actions that only raise them are not offered. */
    maxedParameters(): MaxedParameters {
      const max = getGlobalParameterMaximums(this.game.gameOptions.boardName);
      return {
        temperature: this.game.temperature >= max.temperature,
        oceans: this.game.oceans >= max.oceans,
        venus: this.game.venusScaleLevel >= max.venus,
      };
    },
    conversions(): Partial<Record<string, MissionQuickAction>> {
      const result: Partial<Record<string, MissionQuickAction>> = {};
      for (const action of this.quickActions) {
        if (action.id === 'heat' || action.id === 'plants') {
          result[action.id] = action;
        }
      }
      return result;
    },
    passIndex(): number {
      return this.activeTurnColor === this.thisPlayer.color ? passOptionIndex(this.playerView.waitingFor) : -1;
    },
    endTurnIndex(): number {
      const input = this.playerView.waitingFor;
      if (input?.type !== 'or' || input.optional) {
        return -1;
      }
      return input.options.findIndex((option) => option.type === 'option' && option.title === 'End Turn');
    },
    standardProjectIndex(): number {
      const input = this.playerView.waitingFor;
      if (input?.type !== 'or' || input.optional) {
        return -1;
      }
      return input.options.findIndex((option) => option.type === 'projectCard' && option.title === 'Standard projects');
    },
    standardProjectInput(): SelectProjectCardToPlayModel | undefined {
      const input = this.playerView.waitingFor;
      const option = input?.type === 'or' ? input.options[this.standardProjectIndex] : undefined;
      return option?.type === 'projectCard' ? option : undefined;
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
    SelectProjectCardToPlay,
    MissionTurnButton,
    MissionStandardProjects,
    MissionHudMenus,
    ConfirmDialog,
    MissionDraftWaiting,
    MissionPauseOverlay,
    MissionCardZoom,
    MissionEffectBadges,
    MissionEffectsBar,
    MissionParameters,
    MissionUndoTurn,
    MissionPlayersPanel,
    MissionCardStage,
    MissionPlayerHud,
    DynamicTitle,
    Card,
    PlayersOverview,
    RivalPanel,
    WaitingFor,
    DecisionHeading,
    SelectSpace,
    AppButton,
    Sidebar,
    MissionSettings,
    MissionColonies,
    InfoPanel,
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
    // Music only plays in the window the player is using. Embedded and background browsers can
    // keep a page "visible" while nobody looks at it, so focus matters as well as visibility.
    document.addEventListener('visibilitychange', this.syncMissionAmbience);
    window.addEventListener('focus', this.syncMissionAmbience);
    window.addEventListener('blur', this.syncMissionAmbience);
    window.addEventListener('pagehide', SoundManager.pauseMissionAmbience);
    window.addEventListener('pageshow', this.syncMissionAmbience);
    if (this.game.phase === Phase.PRODUCTION) {
      this.showFollowUpDecision();
    }
  },
  beforeUnmount() {
    document.removeEventListener('visibilitychange', this.syncMissionAmbience);
    window.removeEventListener('focus', this.syncMissionAmbience);
    window.removeEventListener('blur', this.syncMissionAmbience);
    window.removeEventListener('pagehide', SoundManager.pauseMissionAmbience);
    window.removeEventListener('pageshow', this.syncMissionAmbience);
    SoundManager.stopMissionAmbience();
  },
  methods: {
    tradeWithColony(response: InputResponse) {
      if (this.canTradeColonies) {
        this.respondToMenu({type: 'or', index: this.colonyTradeIndex, response});
      }
    },
    openQuickAction(action: MissionQuickAction) {
      const option = actionMenu(this.playerView.waitingFor)?.options[action.index] ?? (this.playerView.waitingFor?.type === 'or' ? this.playerView.waitingFor.options[action.index] : undefined);
      if (action.id === 'sell') {
        this.hudShow('sell');
        return;
      }
      if (action.index === this.colonyTradeIndex && this.canTradeColonies) {
        (this.$refs.coloniesWindow as InstanceType<typeof MissionColonies> | undefined)?.openWindow();
        return;
      }
      // A plain menu entry (no further choice) is done at once, like the other buttons.
      if (action.id.startsWith('menu:') && option?.type === 'option' && option.title !== '${0} (Turmoil ${1})') {
        this.respondToMenu({type: 'or', index: action.index, response: {type: 'option'}});
        return;
      }
      if (action.id === 'heat') {
        // Converting heat spends a resource at once: ask first.
        this.pendingHeat = action.index;
        (this.$refs.heatConfirm as InstanceType<typeof ConfirmDialog> | undefined)?.show();
        return;
      }
      // Every space choice of the action menu (icon or menu) uses the one map placement, with Cancel.
      if (option?.type === 'space') {
        this.closeMissionPanel();
        this.pendingSpace = {input: option, index: action.index};
        return;
      }
      if (action.card && option?.type === 'projectCard') {
        // Standard projects are lifted to the centre like a card from the hand, with their payment.
        const card = option.cards.find((candidate) => candidate.name === action.card);
        if (card) {
          this.projectOrigin = undefined;
          this.projectAutoPlay = false;
          this.previewedProject = card;
          return;
        }
      }
      // Placing a tile (e.g. greenery from plants) happens on the map: no window, only the
      // "Current action" banner and Cancel. Other choices open the decision window.
      if (this.quickInput?.type !== 'space') {
        this.showMissionPanel('actions');
      }
      this.quickAction = action;
    },
    stageCardAction(card: CardModel, origin?: DOMRect) {
      this.closeProjectPreview();
      this.projectOrigin = origin;
      this.stagedAction = this.stagedAction?.name === card.name ? undefined : card;
    },
    useCardActionNow(card: CardModel) {
      const option = this.cardActions;
      if (option) {
        (this.$refs.waitingFor as InstanceType<typeof WaitingFor> | undefined)?.onsave({
          type: 'or', index: option.index, response: {type: 'card', cards: [card.name]},
        });
      }
    },
    useCardAction() {
      const option = this.cardActions;
      const card = this.stagedAction;
      if (option && card) {
        (this.$refs.waitingFor as InstanceType<typeof WaitingFor> | undefined)?.onsave({
          type: 'or', index: option.index, response: {type: 'card', cards: [card.name]},
        });
      }
      this.stagedAction = undefined;
    },
    /** "Actions": the decision waiting for the player, or else everything that can be done now. */
    openActions() {
      const input = this.playerView.waitingFor;
      if (input !== undefined && actionMenu(input) === undefined && !showsCards(input)) {
        this.toggleMissionPanel('actions');
      } else {
        this.hudShow('all');
      }
    },
    /** Ask the other players to undo the last turn. */
    askUndoTurn() {
      (this.$refs.undoTurn as InstanceType<typeof MissionUndoTurn> | undefined)?.ask();
    },
    hudShow(menu: 'all' | 'awards' | 'milestones' | 'actions' | 'sell') {
      (this.$refs.hudMenus as InstanceType<typeof MissionHudMenus> | undefined)?.show(menu);
    },
    showPlayerCards(color: Color) {
      (this.$refs.hudMenus as InstanceType<typeof MissionHudMenus> | undefined)?.showPlayed(color);
    },
    respondToMenu(response: InputResponse) {
      return (this.$refs.waitingFor as InstanceType<typeof WaitingFor> | undefined)?.onsave(response);
    },
    passNow() {
      if (this.passIndex === -1) {
        return;
      }
      (this.$refs.waitingFor as InstanceType<typeof WaitingFor> | undefined)?.onsave({type: 'or', index: this.passIndex, response: {type: 'option'}});
    },
    /**
     * A choice that follows an action (e.g. which effect of a card to use) opens the decision window
     * by itself; the main action menu, tile placement and deck choices have their own places on screen.
     */
    showFollowUpDecision() {
      const input = this.playerView.waitingFor;
      if (!this.cinematic || input === undefined || actionMenu(input) !== undefined || input.type === 'space' || showsCards(input)) {
        return;
      }
      if (this.missionPanel !== 'actions') {
        this.showMissionPanel('actions');
      }
    },
    submitQuickAction(response: InputResponse) {
      if (this.quickAction && this.quickInput) {
        return this.submitProjectChoice(response, [this.quickAction.index], this.quickInput);
      }
      return undefined;
    },
    previewProject(card: CardModel, origin?: DOMRect) {
      if (this.previewedProject?.name === card.name) {
        this.closeProjectPreview();
        return;
      }
      this.projectOrigin = origin;
      this.projectAutoPlay = false;
      this.previewedProject = card;
    },
    showEffectBadges(triggers: Array<{player: Color, card: CardName, effects: string}>) {
      (this.$refs.effectBadges as InstanceType<typeof MissionEffectBadges> | undefined)?.show(triggers);
    },
    showCardPlays(cards: Array<PlayedCardLogModel>) {
      (this.$refs.playersPanel as InstanceType<typeof MissionPlayersPanel> | undefined)?.show(cards);
    },
    async setPaused(paused: boolean) {
      this.pausing = true;
      try {
        const response = await fetch(`${paths.API_PAUSE}?id=${this.playerView.id}&paused=${paused}`);
        if (response.ok) {
          await vueRoot(this).updatePlayer();
        }
      } finally {
        this.pausing = false;
      }
    },
    lightEffect(card: CardName) {
      this.litEffects = new Set([...this.litEffects, card]);
      window.setTimeout(() => {
        const next = new Set(this.litEffects);
        next.delete(card);
        this.litEffects = next;
      }, 2600);
    },
    convertHeatNow() {
      if (this.pendingHeat !== undefined) {
        (this.$refs.waitingFor as InstanceType<typeof WaitingFor> | undefined)?.onsave({type: 'or', index: this.pendingHeat, response: {type: 'option'}});
        this.pendingHeat = undefined;
      }
    },
    dropProject(card: CardModel) {
      // A thrown card opens in the centre straight away (no flight from the pointer).
      this.projectOrigin = undefined;
      this.projectAutoPlay = true;
      this.previewedProject = card;
    },
    closeProjectPreview() {
      const name = this.previewedProject?.name;
      this.previewedProject = undefined;
      this.projectAutoPlay = false;
      const focus = document.activeElement;
      if (name !== undefined && (focus === document.body || focus?.closest('.mission-stage'))) {
        const index = this.allCardsInHand.findIndex((card) => card.name === name);
        (document.querySelectorAll<HTMLElement>('.mission-hand__hit')[index])?.focus({preventScroll: true});
      }
    },
    playPreviewedProject(response: InputResponse) {
      const option = this.projectOption;
      if (option) {
        this.submitProjectChoice(response, option.path, option.input);
        this.closeProjectPreview();
      }
    },
    submitProjectChoice(response: InputResponse, path: number[], input: PlayerInputModel) {
      if (this.cinematic && response.type === 'projectCard' && response.card === CardName.GREENERY_STANDARD_PROJECT && input.type === 'projectCard' && input.greeneryPlacement) {
        this.closeMissionPanel();
        this.pendingGreenery = {input: input.greeneryPlacement, path, payment: response};
        return;
      }
      return this.respondToMenu(path.reduceRight<InputResponse>((child, index) => ({type: 'or', index, response: child}), response));
    },
    placeTile(response: SelectSpaceResponse) {
      if (this.choosingFinalGreenery && this.finalGreenery) {
        return this.respondToMenu({type: 'or', index: this.finalGreenery.placeIndex, response});
      }
      if (this.pendingSpace !== undefined) {
        const index = this.pendingSpace.index;
        this.pendingSpace = undefined;
        return this.respondToMenu({type: 'or', index, response});
      }
      const pending = this.pendingGreenery;
      if (!pending) {
        return this.respondToMenu(response);
      }
      const project: SelectProjectCardToPlayResponse = {...pending.payment, spaceId: response.spaceId};
      return this.respondToMenu(pending.path.reduceRight<InputResponse>((child, index) => ({type: 'or', index, response: child}), project));
    },
    openBoardOverview(section: 'milestones' | 'awards') {
      this.showMissionPanel('details');
      this.$nextTick(() => {
        document.getElementById(`board-${section}`)?.scrollIntoView({block: 'nearest'});
      });
    },
    playStandardProject(response: InputResponse) {
      if (this.standardProjectIndex !== -1 && this.standardProjectInput) {
        this.submitProjectChoice(response, [this.standardProjectIndex], this.standardProjectInput);
      }
    },
    showMissionPanel(panel: MissionPanel) {
      this.quickAction = undefined;
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
      this.quickAction = undefined;
      this.missionPanel = undefined;
      this.missionPanelOpener?.focus({preventScroll: true});
      this.missionPanelOpener = undefined;
    },
    cancelPlacement() {
      if (this.serverPlacement !== undefined && this.playerView.canCancelPlacement === true && this.pendingGreenery === undefined && this.pendingSpace === undefined && !this.choosingFinalGreenery) {
        // The action was already sent: the server takes it back.
        void this.cancelServerPlacement();
        return;
      }
      this.choosingFinalGreenery = false;
      this.pendingGreenery = undefined;
      this.pendingSpace = undefined;
      const input = this.playerView.waitingFor;
      if (this.cancelMapChoice) {
        this.cancelMapChoice();
      }
      this.closeMissionPanel();
      if (input !== undefined && actionMenu(input) === undefined) {
        this.showFollowUpDecision();
      }
    },
    async cancelServerPlacement() {
      try {
        await fetch(paths.API_CANCEL_PLACEMENT + '?id=' + encodeURIComponent(this.playerView.id));
      } finally {
        await vueRoot(this).updatePlayer();
      }
    },
    chooseFinalGreenery() {
      this.closeMissionPanel();
      this.choosingFinalGreenery = true;
    },
    skipFinalGreenery() {
      if (this.finalGreenery) {
        return this.respondToMenu({type: 'or', index: this.finalGreenery.skipIndex, response: {type: 'option'}});
      }
      return undefined;
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
      if (this.cinematic && this.soundsEnabled) {
        SoundManager.unlockEffects();
        this.missionAudioStarted = true;
        this.syncMissionAmbience();
      }
    },
    syncMissionAmbience() {
      if (this.missionAudioStarted && this.cinematic && this.soundsEnabled && this.musicEnabled && !document.hidden && document.hasFocus()) {
        SoundManager.startMissionAmbience();
      } else {
        SoundManager.pauseMissionAmbience();
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

<style lang="less" src="../../styles/mission-hud-layout.less"></style>

<style lang="less" src="../../styles/mission-mobile-game.less"></style>
