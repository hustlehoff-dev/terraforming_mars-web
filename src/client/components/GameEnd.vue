<template>
  <div id="game-end" class="recap">
    <nav class="recap-hero__nav">
      <HomeLink>{{ constants.APP_NAME }}</HomeLink>
      <span class="recap-hero__sep" aria-hidden="true">|</span>
      <span v-i18n>Game summary</span>
      <span class="recap-hero__spacer"></span>
      <a class="recap-navbtn" href="#recap-scores"><span aria-hidden="true">🏆</span>{{ $t('Score') }}</a>
      <a class="recap-navbtn" href="#recap-timeline"><span aria-hidden="true">📈</span>{{ $t('Timeline') }}</a>
      <a class="recap-navbtn" href="#recap-board" @click="boardOpen = true"><span aria-hidden="true">🗺</span>{{ $t('Board') }}</a>
      <a class="recap-navbtn" :href="downloadLogUrl" target="_blank"><span aria-hidden="true">⬇</span>{{ $t('Game log') }}</a>
      <a class="recap-navbtn" href="."><span aria-hidden="true">⌂</span>{{ $t('Go to main page') }}</a>
      <a class="recap-navbtn recap-navbtn--primary" href="new-game"><span aria-hidden="true">＋</span>{{ $t('Create New Game') }}</a>
    </nav>
    <header class="recap-hero">
      <div class="recap-hero__body">
        <div>
          <h1 v-i18n>Game summary</h1>
          <p class="recap-hero__sub"><span class="recap-slash" aria-hidden="true"></span>Terraforming Mars</p>
          <ul class="recap-chips">
            <li><span aria-hidden="true">👥</span>{{ participant.players.length }} {{ $t('players') }}</li>
            <li><span aria-hidden="true">🗺</span>{{ $t(game.gameOptions.boardName) }}</li>
            <li><span aria-hidden="true">⟳</span>{{ game.generation }} {{ $t('generations') }}</li>
          </ul>
        </div>
        <img class="recap-hero__dome" src="assets/board/mars-dome.png" alt="">
      </div>
    </header>

    <!-- Solo: won or lost against the generation limit. -->
    <section v-if="isSoloGame" class="recap-panel recap-solo" :class="game.isSoloModeWin ? 'recap-solo--win' : 'recap-solo--lose'">
      <h2>{{ $t(game.isSoloModeWin ? 'You win!' : 'Sorry, you lose.') }}</h2>
      <p>{{ $t(game.isSoloModeWin ? 'But it isn\'t the reason to stop making Mars better.' : 'Next time you will get more luck!') }}</p>
    </section>

    <section v-if="!isSoloGame || game.isSoloModeWin" class="recap-top">
      <div class="recap-winner">
        <div class="recap-winner__crown" aria-hidden="true">👑</div>
        <div>
          <p class="recap-winner__label" v-i18n>Winner</p>
          <h2>
            <template v-for="(p, index) in winners" :key="p.color"><template v-if="index > 0"> + </template>{{ p.name }}</template>
          </h2>
          <p class="recap-winner__score">{{ $t('Final score') }}: <b>{{ winners[0]?.victoryPointsBreakdown.total }}</b></p>
        </div>
      </div>
      <div class="recap-ranking">
        <h3 class="recap-label" v-i18n>Final ranking</h3>
        <ol>
          <li v-for="(p, index) in playersInPlace" :key="p.color" :class="{'recap-ranking__first': rankOf(p, index) === 1}">
            <span class="recap-ranking__place">{{ rankOf(p, index) }}</span>
            <span class="recap-dot" :class="'player_bg_color_' + p.color" aria-hidden="true"></span>
            <span class="recap-ranking__name">
              <b>{{ p.name }}</b>
              <small>{{ corporationsOf(p) }}</small>
            </span>
            <span class="recap-ranking__score">{{ p.victoryPointsBreakdown.total }}</span>
          </li>
        </ol>
      </div>
    </section>

    <section class="recap-panel">
      <h2 class="recap-title"><span class="recap-slash" aria-hidden="true"></span><span v-i18n>Game overview</span></h2>
      <div class="recap-tiles">
        <div v-for="tile in overviewTiles" :key="tile.key" class="recap-tile">
          <span class="recap-tile__icon" aria-hidden="true">{{ tile.icon }}</span>
          <div>
            <small>{{ $t(tile.label) }}</small>
            <b>{{ tile.value }}</b>
            <em v-if="tile.note">{{ $t(tile.note) }}</em>
          </div>
        </div>
      </div>
    </section>

    <section id="recap-scores" class="recap-panel">
      <h2 class="recap-title">
        <span class="recap-slash" aria-hidden="true"></span><span v-i18n>Score breakdown</span>
        <small v-i18n>How each player earned their final score.</small>
      </h2>
      <div class="recap-table-wrap">
        <table class="recap-table">
          <thead>
            <tr>
              <th v-i18n>Player</th>
              <th v-for="part in scoreParts" :key="part.key"><span class="recap-swatch" :style="{background: part.color}"></span>{{ $t(part.label) }}</th>
              <th v-i18n>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(p, index) in playersInPlace" :key="p.color" :class="{'recap-table__winner': rankOf(p, index) === 1}">
              <td>
                <span class="recap-dot" :class="'player_bg_color_' + p.color" aria-hidden="true"></span>
                <b>{{ p.name }}</b>
                <span v-if="rankOf(p, index) === 1" class="recap-badge" v-i18n>Winner</span>
              </td>
              <td v-for="part in scoreParts" :key="part.key" class="recap-num">{{ part.value(p) }}</td>
              <td class="recap-total">{{ p.victoryPointsBreakdown.total }}</td>
            </tr>
          </tbody>
        </table>
        <div class="recap-bars">
          <div v-for="p in playersInPlace" :key="p.color" class="recap-bars__row">
            <span class="recap-bars__name">{{ p.name }}</span>
            <div class="recap-bars__track">
              <span v-for="part in scoreParts" :key="part.key" class="recap-bars__part"
                :style="{width: barWidth(part.value(p)), background: part.color}" :title="$t(part.label) + ': ' + part.value(p)"></span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="recap-panel">
      <h2 class="recap-title">
        <span class="recap-slash" aria-hidden="true"></span><span v-i18n>What the points are for</span>
        <small v-i18n>Click a row to see what its points are for; click a card to see it.</small>
      </h2>
      <div class="recap-scores">
        <GameEndScore v-for="(p, index) in playersInPlace" :key="p.color" :player="p" :spaces="game.spaces" :rank="rankOf(p, index)" :winner="rankOf(p, index) === 1" />
      </div>
    </section>
    <MissionCardZoom :playerView="participant" />

    <section id="recap-timeline" class="recap-panel">
      <h2 class="recap-title">
        <span class="recap-slash" aria-hidden="true"></span><span v-i18n>Gameplay timeline</span>
        <small v-i18n>Terraforming progress and key moments</small>
      </h2>
      <div class="recap-split">
        <div class="recap-well">
          <h3 class="recap-label" v-i18n>Terraforming progress</h3>
          <VictoryPointChart :datasets="globalsDataset" :generation="game.generation" :animation="true" :id="'global-parameter-chart'" :yAxisLabel="'% completed'" />
        </div>
        <div class="recap-card">
          <h3 class="recap-label" v-i18n>Key generations</h3>
          <ol class="recap-timeline">
            <li v-for="moment in keyMoments" :key="moment.key">
              <b>{{ $t('Gen') }} {{ moment.generation }}</b>
              <span>{{ moment.text }}</span>
            </li>
          </ol>
        </div>
      </div>
    </section>

    <section v-if="!isSoloGame" class="recap-panel">
      <h2 class="recap-title">
        <span class="recap-slash" aria-hidden="true"></span><span v-i18n>Awards and milestones</span>
        <small v-i18n>End-game bonus points for major achievements.</small>
      </h2>
      <div class="recap-split recap-split--even">
        <div class="recap-card">
          <h3 class="recap-label"><span aria-hidden="true">🏆</span> {{ $t('Awards') }}</h3>
          <p v-if="fundedAwards.length === 0" class="recap-empty" v-i18n>No award was funded.</p>
          <div class="recap-ma">
            <div v-for="award in fundedAwards" :key="award.name" class="recap-ma__item">
              <img :src="maImage(award.name)" alt="" @error="hideImage">
              <b>{{ $t(award.name) }}</b>
              <small>{{ $t(awardDescription(award.name)) }}</small>
              <span v-for="leader in awardLeaders(award)" :key="leader.color" class="recap-ma__who">
                <span class="recap-dot" :class="'player_bg_color_' + leader.color" aria-hidden="true"></span>{{ leader.name }}
                <em>{{ leader.score }}</em>
              </span>
            </div>
          </div>
        </div>
        <div class="recap-card">
          <h3 class="recap-label"><span aria-hidden="true">🚩</span> {{ $t('Milestones') }} <small>(5 {{ $t('VP') }})</small></h3>
          <p v-if="claimedMilestones.length === 0" class="recap-empty" v-i18n>No milestone was claimed.</p>
          <div class="recap-ma">
            <div v-for="milestone in claimedMilestones" :key="milestone.name" class="recap-ma__item">
              <img :src="maImage(milestone.name)" alt="" @error="hideImage">
              <b>{{ $t(milestone.name) }}</b>
              <small>{{ $t(milestoneDescription(milestone.name)) }}</small>
              <span class="recap-ma__who">
                <span class="recap-dot" :class="'player_bg_color_' + milestone.color" aria-hidden="true"></span>{{ milestone.playerName }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="recap-panel">
      <h2 class="recap-title">
        <span class="recap-slash" aria-hidden="true"></span><span v-i18n>Player economy and engine</span>
        <small v-i18n>Victory points over the game and the final production.</small>
      </h2>
      <div class="recap-split">
        <div class="recap-well">
          <h3 class="recap-label" v-i18n>Victory points by generation</h3>
          <VictoryPointChart :datasets="vpDataset" :generation="game.generation" :animation="true" :id="'victory-point-chart'" />
        </div>
        <div class="recap-card">
          <h3 class="recap-label" v-i18n>Final production (per generation)</h3>
          <table class="recap-table recap-table--compact">
            <thead>
              <tr>
                <th v-i18n>Player</th>
                <th v-for="resource in productionColumns" :key="resource.key" :title="$t(resource.label)">
                  <span :class="resource.icon" class="recap-resource" aria-hidden="true"></span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in playersInPlace" :key="p.color">
                <td><span class="recap-dot" :class="'player_bg_color_' + p.color" aria-hidden="true"></span>{{ p.name }}</td>
                <td v-for="resource in productionColumns" :key="resource.key" class="recap-num">{{ p[resource.key] }}</td>
              </tr>
            </tbody>
          </table>
          <h3 class="recap-label recap-label--spaced" v-i18n>Global Parameter Contributions</h3>
          <table class="recap-table recap-table--compact">
            <thead>
              <tr>
                <th v-i18n>Player</th>
                <th v-i18n>Temperature</th>
                <th v-i18n>Oxygen</th>
                <th v-i18n>Oceans</th>
                <th v-if="game.gameOptions.expansions.venus" v-i18n>Venus</th>
                <th v-i18n>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="data in playerContributionsData" :key="data.color">
                <td><span class="recap-dot" :class="'player_bg_color_' + data.color" aria-hidden="true"></span>{{ data.player }}</td>
                <td class="recap-num">{{ data.temp }}</td>
                <td class="recap-num">{{ data.oxygen }}</td>
                <td class="recap-num">{{ data.oceans }}</td>
                <td v-if="game.gameOptions.expansions.venus" class="recap-num">{{ data.venus }}</td>
                <td class="recap-num"><b>{{ data.total }}</b></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section v-if="insights.length > 0" class="recap-panel recap-panel--dark">
      <h2 class="recap-title">
        <span class="recap-slash" aria-hidden="true"></span><span v-i18n>Post-game insights</span>
        <small v-i18n>Notable takeaways and standout performances from this match.</small>
      </h2>
      <div class="recap-insights">
        <div v-for="insight in insights" :key="insight.key" class="recap-insight">
          <span class="recap-insight__icon" aria-hidden="true">{{ insight.icon }}</span>
          <div>
            <b>{{ $t(insight.title) }}</b>
            <p class="recap-insight__who">
              <template v-for="(who, index) in insight.players" :key="who.color">
                <template v-if="index > 0"> · </template>
                <span class="recap-dot" :class="'player_bg_color_' + who.color" aria-hidden="true"></span>{{ who.name }}
              </template>
              <template v-if="insight.badge">{{ insight.badge }}</template>
            </p>
            <small>{{ insight.text }}</small>
          </div>
        </div>
      </div>
    </section>

    <details id="recap-board" class="recap-panel recap-more" :open="boardOpen" @toggle="boardOpen = ($event.target as HTMLDetailsElement).open">
      <summary class="recap-title"><span class="recap-slash" aria-hidden="true"></span><span v-i18n>Final situation on the board</span><small v-i18n>and the game log</small></summary>
      <div class="recap-more__body">
        <div>
          <Board
            :spaces="game.spaces"
            :expansions="game.gameOptions.expansions"
            :venusScaleLevel="game.venusScaleLevel"
            :altVenusBoard="game.gameOptions.altVenusBoard"
            :boardName="game.gameOptions.boardName"
            :oceans_count="game.oceans"
            :oxygen_level="game.oxygenLevel"
            :temperature="game.temperature"
            :tileView="tileView"
            @toggleTileView="cycleTileView()" />
          <MoonBoard v-if="game.moon !== undefined" :model="game.moon" :tileView="tileView" />
          <PlanetaryTracks v-if="game.gameOptions.expansions.pathfinders" :tracks="game.pathfinders" :gameOptions="game.gameOptions" />
          <DeltaProjectBoard v-if="game.gameOptions.expansions.deltaProject" :players="participant.players" />
        </div>
        <div class="recap-more__log">
          <LogPanel :viewModel="participant" />
          <a :href="downloadLogUrl" target="_blank" v-i18n>Download game log</a>
        </div>
      </div>
    </details>
  </div>
</template>

<script lang="ts">

import {defineComponent} from 'vue';
import * as constants from '@/common/constants';
import {setDocumentTitle} from '@/client/utils/documentTitle';
import {setFaviconStatus} from '@/client/utils/favicon';
import {getPreferences} from '@/client/utils/PreferencesManager';
import {paths} from '@/common/app/paths';
import {GameModel} from '@/common/models/GameModel';
import {PublicPlayerModel, ViewModel} from '@/common/models/PlayerModel';
import Board from '@/client/components/Board.vue';
import MoonBoard from '@/client/components/moon/MoonBoard.vue';
import {nextTileView, TileView} from '@/client/components/board/TileView';
import PlanetaryTracks from '@/client/components/pathfinders/PlanetaryTracks.vue';
import DeltaProjectBoard from '@/client/components/delta/DeltaProjectBoard.vue';
import LogPanel from '@/client/components/logpanel/LogPanel.vue';
import HomeLink from '@/client/components/common/HomeLink.vue';
import VictoryPointChart, {DataSet} from '@/client/components/gameend/VictoryPointChart.vue';
import GameEndScore from '@/client/components/gameend/GameEndScore.vue';
import MissionCardZoom from '@/client/components/board/MissionCardZoom.vue';
import {Color} from '@/common/Color';
import {CardType} from '@/common/cards/CardType';
import {getCard} from '@/client/cards/ClientCardManifest';
import {GlobalParameter} from '@/common/GlobalParameter';
import {getGlobalParameterMaximums} from '@/common/boards/GlobalParameterMaximums';
import {$t, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {FundedAwardModel} from '@/common/models/FundedAwardModel';
import {ClaimedMilestoneModel} from '@/common/models/ClaimedMilestoneModel';
import {getAward, getMilestone} from '@/client/MilestoneAwardManifest';
import {AwardName} from '@/common/ma/AwardName';
import {MilestoneName} from '@/common/ma/MilestoneName';

type ScorePart = {key: string, label: string, color: string, value: (p: PublicPlayerModel) => number};
type ProductionKey = 'megacreditProduction' | 'steelProduction' | 'titaniumProduction' | 'plantProduction' | 'energyProduction' | 'heatProduction';
type Insight = {key: string, icon: string, title: string, players: Array<PublicPlayerModel>, badge?: string, text: string};
type Tile = {key: string, icon: string, label: string, value: string, note?: string};

const SCORE_PARTS: ReadonlyArray<ScorePart> = [
  {key: 'tr', label: 'Terraform Rating', color: '#e8743b', value: (p) => p.victoryPointsBreakdown.terraformRating},
  {key: 'awards', label: 'Awards', color: '#2bb3c0', value: (p) => p.victoryPointsBreakdown.awards},
  {key: 'milestones', label: 'Milestones', color: '#3a6fd8', value: (p) => p.victoryPointsBreakdown.milestones},
  {key: 'tiles', label: 'Cities and greeneries', color: '#4caf50', value: (p) => p.victoryPointsBreakdown.city + p.victoryPointsBreakdown.greenery},
  {key: 'cards', label: 'Cards and other', color: '#9b6ad6', value: (p) => {
    const b = p.victoryPointsBreakdown;
    return b.total - b.terraformRating - b.awards - b.milestones - b.city - b.greenery;
  }},
];

const PRODUCTION_COLUMNS: ReadonlyArray<{key: ProductionKey, label: string, icon: string}> = [
  {key: 'megacreditProduction', label: 'Megacredits', icon: 'recap-resource--megacredits'},
  {key: 'steelProduction', label: 'Steel', icon: 'recap-resource--steel'},
  {key: 'titaniumProduction', label: 'Titanium', icon: 'recap-resource--titanium'},
  {key: 'plantProduction', label: 'Plants', icon: 'recap-resource--plants'},
  {key: 'energyProduction', label: 'Energy', icon: 'recap-resource--energy'},
  {key: 'heatProduction', label: 'Heat', icon: 'recap-resource--heat'},
];

function totalProduction(p: PublicPlayerModel): number {
  return PRODUCTION_COLUMNS.reduce((sum, column) => sum + p[column.key], 0);
}

export default defineComponent({
  name: 'GameEnd',
  props: {
    participant: {
      type: Object as () => ViewModel,
      required: true,
    },
  },
  data(): {tileView: TileView, boardOpen: boolean} {
    return {
      tileView: 'show',
      boardOpen: false,
    };
  },
  computed: {
    game(): GameModel {
      return this.participant.game;
    },
    constants(): typeof constants {
      return constants;
    },
    downloadLogUrl(): string {
      return `${paths.END_GAME_LOG}?id=${this.participant.id}`;
    },
    scoreParts(): ReadonlyArray<ScorePart> {
      return SCORE_PARTS;
    },
    productionColumns(): ReadonlyArray<{key: ProductionKey, label: string, icon: string}> {
      return PRODUCTION_COLUMNS;
    },
    playersInPlace(): Array<PublicPlayerModel> {
      return this.participant.players.toSorted((a, b) =>
        (b.victoryPointsBreakdown.total - a.victoryPointsBreakdown.total) || (b.megacredits - a.megacredits));
    },
    winners(): Array<PublicPlayerModel> {
      const first = this.playersInPlace[0];
      if (first === undefined) {
        return [];
      }
      return this.playersInPlace.filter((p) =>
        p.victoryPointsBreakdown.total === first.victoryPointsBreakdown.total && p.megacredits === first.megacredits);
    },
    isSoloGame(): boolean {
      return this.participant.players.length === 1;
    },
    maxTotal(): number {
      return Math.max(1, ...this.participant.players.map((p) => p.victoryPointsBreakdown.total));
    },
    overviewTiles(): Array<Tile> {
      const game = this.game;
      const max = getGlobalParameterMaximums(game.gameOptions.boardName);
      const elapsed = this.participant.players.reduce((sum, p) => sum + (p.timer?.sumElapsed ?? 0), 0);
      const minutes = Math.round(elapsed / 60000);
      const tiles: Array<Tile> = [
        {key: 'time', icon: '⏱', label: 'Players\' time', value: minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} m` : `${minutes} m`},
        {key: 'generations', icon: '⟳', label: 'Generations', value: String(game.generation)},
        {key: 'oxygen', icon: '🫧', label: 'Final oxygen', value: `${game.oxygenLevel}%`, note: game.oxygenLevel >= max.oxygen ? '(Max)' : undefined},
        {key: 'temperature', icon: '🌡', label: 'Final temperature', value: `${game.temperature > 0 ? '+' : ''}${game.temperature}°C`, note: game.temperature >= max.temperature ? '(Max)' : undefined},
        {key: 'oceans', icon: '💧', label: 'Oceans', value: `${game.oceans} / ${max.oceans}`, note: game.oceans >= max.oceans ? '(Complete)' : undefined},
      ];
      if (game.gameOptions.expansions.venus) {
        tiles.push({key: 'venus', icon: '♀', label: 'Venus', value: `${game.venusScaleLevel}%`, note: game.venusScaleLevel >= max.venus ? '(Max)' : undefined});
      }
      return tiles;
    },
    vpDataset(): ReadonlyArray<DataSet> {
      return this.participant.players.map((player) => ({
        label: player.name,
        data: player.victoryPointsByGeneration,
        color: player.color,
      }));
    },
    globalsDataset(): ReadonlyArray<DataSet> {
      const dataset: Array<DataSet> = [];
      const gpg = this.game.globalsPerGeneration;
      function getValues(param: GlobalParameter, min: number, max: number): ReadonlyArray<number> {
        return gpg.map((entry) => 100 * ((entry[param] ?? min) - min) / (max - min));
      }
      const max = getGlobalParameterMaximums(this.game.gameOptions.boardName);
      dataset.push({label: $t('Temperature'), color: 'red', data: getValues(GlobalParameter.TEMPERATURE, constants.MIN_TEMPERATURE, max.temperature)});
      dataset.push({label: $t('Oxygen'), color: 'green', data: getValues(GlobalParameter.OXYGEN, constants.MIN_OXYGEN_LEVEL, max.oxygen)});
      dataset.push({label: $t('Oceans'), color: 'blue', data: getValues(GlobalParameter.OCEANS, 0, max.oceans)});
      if (this.game.gameOptions.expansions.venus === true) {
        dataset.push({label: $t('Venus'), color: 'yellow', data: getValues(GlobalParameter.VENUS, constants.MIN_VENUS_SCALE, max.venus)});
      }
      if (this.game.gameOptions.expansions.moon === true) {
        dataset.push({label: $t('L. Habitat'), color: 'orange', data: getValues(GlobalParameter.MOON_HABITAT_RATE, 0, 8)});
        dataset.push({label: $t('L. Mining'), color: 'pink', data: getValues(GlobalParameter.MOON_MINING_RATE, 0, 8)});
        dataset.push({label: $t('L. Logistic'), color: 'purple', data: getValues(GlobalParameter.MOON_LOGISTIC_RATE, 0, 8)});
      }
      return dataset;
    },
    /** The first generation each step of the terraforming was reached. */
    keyMoments(): Array<{key: string, generation: number, text: string}> {
      const gpg = this.game.globalsPerGeneration;
      const max = getGlobalParameterMaximums(this.game.gameOptions.boardName);
      const moments: Array<{key: string, generation: number, text: string}> = [{key: 'start', generation: 1, text: $t('Game start: Mars is cold and dry.')}];
      const first = (test: (entry: Partial<Record<GlobalParameter, number>>) => boolean) => {
        const index = gpg.findIndex(test);
        return index === -1 ? undefined : index + 1;
      };
      const add = (key: string, generation: number | undefined, text: string) => {
        if (generation !== undefined) {
          moments.push({key, generation, text});
        }
      };
      add('ocean', first((e) => (e[GlobalParameter.OCEANS] ?? 0) >= 1), $t('First ocean placed.'));
      const halfOxygen = Math.ceil(max.oxygen / 2);
      add('oxygen', first((e) => (e[GlobalParameter.OXYGEN] ?? 0) >= halfOxygen), translateTextWithParams('Oxygen reaches ${0}%.', [String(halfOxygen)]));
      add('temperature', first((e) => (e[GlobalParameter.TEMPERATURE] ?? constants.MIN_TEMPERATURE) >= 0), $t('Temperature hits 0°C.'));
      add('oceans', first((e) => (e[GlobalParameter.OCEANS] ?? 0) >= max.oceans), translateTextWithParams('Final ocean placed (${0}/${0}).', [String(max.oceans)]));
      moments.push({key: 'end', generation: this.game.generation, text: $t('Game end.')});
      return moments.toSorted((a, b) => a.generation - b.generation);
    },
    fundedAwards(): Array<FundedAwardModel> {
      return this.game.awards.filter((award) => award.playerName !== undefined);
    },
    claimedMilestones(): Array<ClaimedMilestoneModel> {
      return this.game.milestones.filter((milestone) => milestone.playerName !== undefined);
    },
    playerContributionsData(): Array<{player: string, color: Color, temp: number, oxygen: number, oceans: number, venus: number, total: number}> {
      return this.participant.players.map((player) => {
        const steps = player.globalParameterSteps || {};
        const temp = steps[GlobalParameter.TEMPERATURE] || 0;
        const oxygen = steps[GlobalParameter.OXYGEN] || 0;
        const oceans = steps[GlobalParameter.OCEANS] || 0;
        const venus = steps[GlobalParameter.VENUS] || 0;
        const moon = (steps[GlobalParameter.MOON_HABITAT_RATE] || 0) + (steps[GlobalParameter.MOON_MINING_RATE] || 0) + (steps[GlobalParameter.MOON_LOGISTIC_RATE] || 0);
        return {player: player.name, color: player.color, temp, oxygen, oceans, venus, total: temp + oxygen + oceans + venus + moon};
      });
    },
    insights(): Array<Insight> {
      const players = this.participant.players;
      if (players.length < 2) {
        return [];
      }
      const insights: Array<Insight> = [];
      const leaders = (value: (p: PublicPlayerModel) => number): {top: Array<PublicPlayerModel>, value: number} => {
        const top = Math.max(...players.map(value));
        return {top: players.filter((p) => value(p) === top), value: top};
      };

      const engine = leaders(totalProduction);
      insights.push({
        key: 'engine', icon: '⚙', title: 'Most efficient engine', players: engine.top,
        text: translateTextWithParams('Highest final production (${0} in total).', [String(engine.value)]),
      });

      const surge = leaders((p) => {
        const vp = p.victoryPointsByGeneration;
        return vp.length < 2 ? 0 : vp[vp.length - 1] - vp[Math.max(0, vp.length - 5)];
      });
      if (surge.value > 0) {
        insights.push({
          key: 'surge', icon: '📈', title: 'Late game surge', players: surge.top,
          text: translateTextWithParams('Gained ${0} points in the final 4 generations.', [String(surge.value)]),
        });
      }

      const generations = Math.max(0, ...players.map((p) => p.victoryPointsByGeneration.length));
      let bestGeneration = 0;
      let bestGain = -Infinity;
      for (let g = 1; g < generations; g++) {
        const gain = players.reduce((sum, p) => sum + ((p.victoryPointsByGeneration[g] ?? 0) - (p.victoryPointsByGeneration[g - 1] ?? 0)), 0);
        if (gain > bestGain) {
          bestGain = gain;
          bestGeneration = g + 1;
        }
      }
      if (bestGeneration > 0) {
        insights.push({
          key: 'generation', icon: '⭐', title: 'Best generation', players: [], badge: `${$t('Generation')} ${bestGeneration}`,
          text: translateTextWithParams('Largest combined point gain (${0} points) across all players.', [String(bestGain)]),
        });
      }

      const milestones = leaders((p) => this.claimedMilestones.filter((m) => m.color === p.color).length);
      if (milestones.value > 0) {
        insights.push({
          key: 'milestones', icon: '🏅', title: 'Most milestones', players: milestones.top,
          text: translateTextWithParams('Claimed ${0} milestone(s): ${1} VP.', [String(milestones.value), String(milestones.value * 5)]),
        });
      }

      const terraformer = leaders((p) => this.playerContributionsData.find((data) => data.color === p.color)?.total ?? 0);
      if (terraformer.value > 0) {
        insights.push({
          key: 'terraformer', icon: '🌍', title: 'Top terraformer', players: terraformer.top,
          text: translateTextWithParams('Raised the global parameters ${0} steps.', [String(terraformer.value)]),
        });
      }
      return insights;
    },
  },
  components: {
    HomeLink,
    Board,
    LogPanel,
    MoonBoard,
    PlanetaryTracks,
    DeltaProjectBoard,
    VictoryPointChart,
    GameEndScore,
    MissionCardZoom,
  },
  mounted() {
    setDocumentTitle('🏁 | ' + this.game.name);
    if (getPreferences().experimental_ui) {
      setFaviconStatus('ended');
    }
  },
  methods: {
    cycleTileView(): void {
      this.tileView = nextTileView(this.tileView);
    },
    /** Place of a player: players with the same total and M€ share it. */
    rankOf(player: PublicPlayerModel, index: number): number {
      const players = this.playersInPlace;
      let rank = index;
      while (rank > 0 && players[rank - 1].victoryPointsBreakdown.total === player.victoryPointsBreakdown.total && players[rank - 1].megacredits === player.megacredits) {
        rank--;
      }
      return rank + 1;
    },
    corporationsOf(p: PublicPlayerModel): string {
      return p.tableau
        .filter((card) => getCard(card.name)?.type === CardType.CORPORATION)
        .map((card) => translateText(card.name)).join(' + ');
    },
    barWidth(value: number): string {
      return `${Math.max(0, value) / this.maxTotal * 100}%`;
    },
    maImage(name: string): string {
      return `assets/ma/${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
    },
    hideImage(event: Event): void {
      if (event.target instanceof HTMLElement) {
        event.target.style.visibility = 'hidden';
      }
    },
    awardDescription(name: AwardName): string {
      return getAward(name)?.description ?? '';
    },
    milestoneDescription(name: MilestoneName): string {
      return getMilestone(name)?.description ?? '';
    },
    /** The players placed in an award: 1st (and 2nd with 3+ players and no tie for 1st), with the VP it gives. */
    awardLeaders(award: FundedAwardModel): Array<{color: Color, name: string, score: string}> {
      const scores = award.scores.toSorted((a, b) => b.score - a.score);
      const top = scores[0]?.score;
      const firsts = scores.filter((s) => s.score === top);
      const placed = firsts.map((s) => ({...s, vp: 5}));
      if (this.participant.players.length > 2 && firsts.length === 1) {
        const second = scores.find((s) => s.score < top);
        if (second !== undefined) {
          placed.push(...scores.filter((s) => s.score === second.score).map((s) => ({...s, vp: 2})));
        }
      }
      return placed.map((s) => ({
        color: s.color,
        name: this.participant.players.find((p) => p.color === s.color)?.name ?? s.color,
        score: `${s.score} → +${s.vp}`,
      }));
    },
  },
});

</script>

<style lang="less">
// End of the game: a recap page in warm Mars colours.
// The whole page over Mars from orbit.
body:has(#game-end.recap) {
  background:
    radial-gradient(circle at 50% 0%, #e8743b33, transparent 60%),
    linear-gradient(#120a06cc, #120a06f2 70%),
    url(./assets/board/mars-orbit.jpg) center top / cover fixed no-repeat,
    #120a06;
}

#game-end.recap {
  // Headings of the light panels: no glow from the global heading styles.
  h1, h2, h3, small, b {
    text-shadow: none;
  }

  .recap-hero h1 {
    text-shadow: 0 4px 18px #000;
  }

  --recap-panel: #fbf4ec;
  --recap-card: #fffaf4;
  --recap-line: #ead9c6;
  --recap-text: #2d1d14;
  --recap-muted: #7d6656;
  --recap-accent: #e8743b;

  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 16px 40px;
  color: var(--recap-text);
}

.recap-hero {
  overflow: hidden;
  margin: 0 -16px;
  border-radius: 0 0 22px 22px;
  background:
    linear-gradient(90deg, #120a06f2 0%, #120a06a0 50%, #120a0620 100%),
    url(./assets/board/mars-orbit.jpg) center 30% / cover no-repeat,
    #2a1810;
  color: #fff;
  box-shadow: 0 18px 40px #0009;
}

.recap-hero__nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
  padding: 12px 24px;
  background: #0007;
  font-size: 0.9rem;

  a {
    color: #fff;
    text-decoration: none;

    &:hover {
      color: #ffc58f;
    }
  }
}

.recap-hero__nav {
  position: sticky;
  z-index: 20;
  top: 0;
  margin: 0 -16px -20px;
  border-bottom: 1px solid #ffffff1f;
  background: #120a06e6;
  backdrop-filter: blur(8px);
  color: #fff;
}

.recap-navbtn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid #ffffff38;
  border-radius: 9px;
  background: #ffffff14;
  font-weight: 700;
  white-space: nowrap;
  transition: background 120ms ease, border-color 120ms ease;

  &:hover {
    border-color: #ffb27a;
    background: #ffffff24;
  }

  &--primary {
    border-color: #e8743b;
    background: #e8743b;

    &:hover {
      background: #f08a52;
    }
  }
}

.recap-hero__sep {
  opacity: 0.5;
}

.recap-hero__spacer {
  flex: 1;
}

.recap-hero__body {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  padding: 28px 32px 30px;

  h1 {
    margin: 0;
    color: #fff;
    font-size: clamp(2.2rem, 6vw, 4rem);
    line-height: 1;
    text-shadow: 0 4px 18px #000;
  }
}

.recap-hero__sub {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 8px 0 0;
  font-size: 1.4rem;
  letter-spacing: 0.12em;
}

.recap-hero__dome {
  width: clamp(110px, 20vw, 260px);
  flex: none;
  filter: drop-shadow(0 10px 24px #000c);
}

.recap-slash {
  display: inline-block;
  width: 6px;
  height: 1.1em;
  flex: none;
  border-radius: 2px;
  background: var(--recap-accent, #e8743b);
  transform: skewX(-20deg);
}

.recap-chips {
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
    border: 1px solid #ffffff38;
    border-radius: 8px;
    background: #0008;
    font-size: 0.85rem;
  }
}

.recap-panel {
  padding: 18px 20px;
  border: 1px solid var(--recap-line);
  border-radius: 18px;
  background: var(--recap-panel);
  box-shadow: 0 12px 30px #0006;

  &--dark {
    border-color: #6b3a1f;
    background: linear-gradient(160deg, #5a2c16, #2e1810);
    color: #fff;

    .recap-title {
      color: #fff;

      small {
        color: #f1d3bd;
      }
    }
  }
}

.recap-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin: 0 0 14px;
  color: var(--recap-text);
  font-size: 1.35rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;

  small {
    margin-left: auto;
    color: var(--recap-muted);
    font-size: 0.85rem;
    font-weight: 500;
    letter-spacing: 0;
    text-transform: none;
  }
}

.recap-label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 10px;
  color: var(--recap-text);
  font-size: 0.95rem;
  font-weight: 900;
  letter-spacing: 0.06em;
  text-transform: uppercase;

  small {
    color: var(--recap-muted);
    font-weight: 600;
    text-transform: none;
  }

  &--spaced {
    margin-top: 18px;
  }
}

.recap-dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  flex: none;
  margin-right: 6px;
  border-radius: 50%;
  vertical-align: -1px;
  box-shadow: 0 0 0 2px #fff, 0 0 0 3px #0003;
}

.recap-solo {
  text-align: center;

  h2 {
    margin: 0 0 6px;
  }

  &--win h2 {
    color: #2e8b57;
  }

  &--lose h2 {
    color: #b23a1d;
  }
}

.recap-top {
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  padding: 14px;
  border: 1px solid var(--recap-line);
  border-radius: 18px;
  background: var(--recap-panel);
  box-shadow: 0 12px 30px #0006;
}

.recap-winner {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 24px;
  border-radius: 14px;
  background:
    linear-gradient(90deg, #4a2010f2, #4a201099 60%, #4a201040),
    url(./assets/board/mars-orbit.jpg) center 60% / cover no-repeat;
  color: #fff;

  h2 {
    margin: 0;
    color: #fff;
    font-size: clamp(1.8rem, 4vw, 2.8rem);
    line-height: 1.1;
  }
}

.recap-winner__crown {
  font-size: 3.4rem;
  filter: drop-shadow(0 4px 10px #000a);
}

.recap-winner__label {
  margin: 0 0 4px;
  color: #ffc35a;
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.recap-winner__score {
  display: inline-block;
  margin: 10px 0 0;
  padding: 4px 14px;
  border: 1px solid #ffffff55;
  border-radius: 8px;
  background: #0006;
}

.recap-ranking {
  padding: 8px 6px;

  ol {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 12px;
    border-radius: 10px;
    background: #f1e6da;
  }

  .recap-ranking__first {
    background: linear-gradient(90deg, #ffd29a, #ffb46a);
  }
}

.recap-ranking__place {
  display: grid;
  width: 26px;
  height: 26px;
  flex: none;
  place-items: center;
  border-radius: 50%;
  background: #fff;
  font-weight: 900;
  box-shadow: 0 1px 3px #0003;

  .recap-ranking__first & {
    background: #f2a531;
    color: #fff;
  }
}

.recap-ranking__name {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;

  small {
    overflow: hidden;
    color: var(--recap-muted);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.recap-ranking__score {
  font-size: 1.3rem;
  font-weight: 900;
}

.recap-tiles {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
}

.recap-tile {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--recap-line);
  border-radius: 12px;
  background: var(--recap-card);

  small {
    display: block;
    color: var(--recap-muted);
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
  }

  b {
    font-size: 1.5rem;
  }

  em {
    margin-left: 6px;
    color: #3c9a52;
    font-size: 0.8rem;
    font-style: normal;
    font-weight: 700;
  }
}

.recap-tile__icon {
  display: grid;
  width: 42px;
  height: 42px;
  flex: none;
  place-items: center;
  border-radius: 12px;
  background: #fde5d2;
  font-size: 1.4rem;
}

.recap-table-wrap {
  display: grid;
  gap: 14px;
}

.recap-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0 6px;

  th {
    padding: 4px 10px;
    color: var(--recap-muted);
    font-size: 0.75rem;
    font-weight: 800;
    text-align: left;
    text-transform: uppercase;
  }

  td {
    padding: 10px;
    background: var(--recap-card);

    &:first-child {
      border-radius: 10px 0 0 10px;
    }

    &:last-child {
      border-radius: 0 10px 10px 0;
    }
  }

  &--compact td {
    padding: 6px 8px;
  }

  .recap-table__winner td {
    background: #ffe6c7;
  }
}

.recap-swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 6px;
  border-radius: 2px;
}

.recap-num {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.recap-total {
  font-size: 1.4rem;
  font-weight: 900;
}

.recap-badge {
  margin-left: 8px;
  padding: 1px 8px;
  border-radius: 6px;
  background: #f2a531;
  color: #fff;
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
}

.recap-bars {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.recap-bars__row {
  display: grid;
  align-items: center;
  gap: 12px;
  grid-template-columns: 9rem 1fr;
}

.recap-bars__name {
  overflow: hidden;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recap-bars__track {
  display: flex;
  overflow: hidden;
  height: 14px;
  border-radius: 999px;
  background: #efe2d4;
}

.recap-bars__part {
  height: 100%;
}

.recap-scores {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr));
}

.recap-split {
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);

  &--even {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.recap-card {
  padding: 14px 16px;
  border: 1px solid var(--recap-line);
  border-radius: 14px;
  background: var(--recap-card);
}

// Charts draw light text: they sit in a dark well.
.recap-well {
  min-width: 0;
  padding: 14px 16px;
  border-radius: 14px;
  background: linear-gradient(160deg, #2e1d16, #1a110d);

  .recap-label {
    color: #fff;
  }
}

.recap-timeline {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 0 0 0 22px;
  list-style: none;

  &::before {
    content: '';
    position: absolute;
    top: 6px;
    bottom: 6px;
    left: 6px;
    width: 2px;
    background: #cfe3d6;
  }

  li {
    position: relative;
    display: grid;
    gap: 10px;
    grid-template-columns: 4.2rem 1fr;
    font-size: 0.9rem;

    &::before {
      content: '';
      position: absolute;
      top: 3px;
      left: -22px;
      width: 10px;
      height: 10px;
      border: 2px solid #2f8f6a;
      border-radius: 50%;
      background: #fff;
    }
  }
}

.recap-empty {
  margin: 0;
  color: var(--recap-muted);
}

.recap-ma {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
}

.recap-ma__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 10px;
  border: 1px solid var(--recap-line);
  border-radius: 12px;
  background: #fff;
  text-align: center;

  img {
    width: 110px;
    height: 65px;
    object-fit: contain;
  }

  small {
    color: var(--recap-muted);
    font-size: 0.75rem;
  }
}

.recap-ma__who {
  display: inline-flex;
  align-items: center;
  margin-top: 4px;
  padding: 3px 10px;
  border-radius: 8px;
  background: #fde5d2;
  font-weight: 800;

  em {
    margin-left: 8px;
    color: var(--recap-muted);
    font-size: 0.75rem;
    font-style: normal;
  }
}

.recap-resource {
  display: inline-block;
  width: 22px;
  height: 22px;
  background-position: center;
  background-repeat: no-repeat;
  background-size: contain;

  &--megacredits { background-image: url(./assets/resources/megacredit.png); }
  &--steel { background-image: url(./assets/resources/steel.png); }
  &--titanium { background-image: url(./assets/resources/titanium.png); }
  &--plants { background-image: url(./assets/resources/plant.png); }
  &--energy { background-image: url(./assets/resources/power.png); }
  &--heat { background-image: url(./assets/resources/heat.png); }
}

.recap-insights {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.recap-insight {
  display: flex;
  gap: 12px;
  padding: 14px;
  border: 1px solid #ffffff2a;
  border-radius: 14px;
  background: #ffffff12;

  b {
    font-size: 1.05rem;
  }

  small {
    color: #f1d3bd;
  }
}

.recap-insight__icon {
  font-size: 1.8rem;
}

.recap-insight__who {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin: 6px 0;
  font-weight: 800;
}

.recap-more {
  > summary {
    margin: 0;
    cursor: pointer;
    list-style: none;

    &::-webkit-details-marker {
      display: none;
    }
  }

  &[open] > summary {
    margin-bottom: 14px;
  }
}

.recap-more__body {
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
}

.recap-more__log {
  overflow: auto;
  max-height: 900px;
  padding: 12px;
  border-radius: 14px;
  background: #1a110d;
  color: #eee;
}

@media (max-width: 900px) {
  .recap-top,
  .recap-split,
  .recap-split--even,
  .recap-more__body {
    grid-template-columns: 1fr;
  }

  .recap-table-wrap {
    overflow-x: auto;
  }
}

@media (max-width: 560px) {
  .recap-hero__body {
    padding: 22px 18px;
  }

  .recap-hero__dome {
    display: none;
  }

  .recap-bars__row {
    grid-template-columns: 1fr;
  }
}
</style>
