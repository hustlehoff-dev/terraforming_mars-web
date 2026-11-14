<template>
  <div :class="gameBoardClassName">
    <div class="hide-tile-button-container">
      <div class="hide-tile-button" @click="$emit('toggleTileView')" data-test="hide-tiles-button" v-i18n>
        {{ tileView }} tiles
      </div>
    </div>
    <Teleport :to="orbitDock ?? 'body'" :disabled="!orbitDock">
      <div
        id="colony_spaces"
        class="board-outer-spaces"
        :class="{'board-outer-spaces--dock': orbitDock}"
        @pointerover="inspectFromEvent"
        @pointerout="leaveSector"
        @focusin="inspectFromEvent"
        @focusout="leaveSector"
        @click="inspectFromEvent"
        @keydown="navigateAtlas">
        <BoardSpace
          v-for="station in orbitalSpaces"
          :key="station.id"
          :space="station"
          :text="orbitalName(station)"
          :tileView="tileView"
          :class="[atlasSpaceClasses(station.id), ownershipClasses(station)]"
          :tabindex="atlas ? 0 : undefined"
          :role="atlas ? 'button' : undefined"
          :aria-label="atlas ? $t(orbitalName(station)) : undefined"
          :aria-describedby="inspectedSpace === station.id ? sectorDescriptionId : undefined" />
      </div>
    </Teleport>

    <div class="global-numbers" :class="{'global-numbers--large': isLargeBoard}">
      <div class="global-numbers-temperature">
        <div :class="getScaleCSS(lvl)" v-for="(lvl, idx) in getValuesForParameter('temperature')" :key="idx">{{ lvl.strValue }}</div>
      </div>

      <div class="global-numbers-oxygen">
        <div :class="getScaleCSS(lvl)" v-for="(lvl, idx) in getValuesForParameter('oxygen')" :key="idx">{{ lvl.strValue }}</div>
      </div>

      <div class="global-numbers-venus" v-if="expansions.venus">
        <div :class="getScaleCSS(lvl)" v-for="(lvl, idx) in getValuesForParameter('venus')" :key="idx">{{ lvl.strValue }}</div>
      </div>

      <div class="global-numbers-oceans">
        <span v-if="oceans_count === globalParameterMaximums.oceans">
          <img width="26" src="assets/misc/circle-checkmark.png" class="board-ocean-checkmark" :alt="$t('Completed!')">
        </span>
        <span v-else>
          {{ oceans_count }}/{{ globalParameterMaximums.oceans }}
        </span>
      </div>

      <div v-if="expansions.ares && aresData !== undefined">
        <div v-if="aresData.hazardData.erosionOceanCount.available">
          <div class="global-ares-erosions-icon"></div>
          <div class="global-ares-erosions-val">{{ aresData.hazardData.erosionOceanCount.threshold }}</div>
        </div>
        <div v-if="aresData.hazardData.removeDustStormsOceanCount.available">
          <div class="global-ares-remove-dust-storms-icon"></div>
          <div class="global-ares-remove-dust-storms-val">{{ aresData.hazardData.removeDustStormsOceanCount.threshold }}</div>
        </div>
        <div v-if="aresData.hazardData.severeErosionTemperature.available">
          <div class="global-ares-severe-erosions"
            :class="'global-ares-severe-erosions-'+aresData.hazardData.severeErosionTemperature.threshold"></div>
        </div>
        <div v-if="aresData.hazardData.severeDustStormOxygen.available">
          <div class="global-ares-severe-dust-storms"
            :class="'global-ares-severe-dust-storms-'+aresData.hazardData.severeDustStormOxygen.threshold"></div>
        </div>
      </div>

      <div v-if="altVenusBoard" class="global-alt-venus">
        <div class="std-wild-resource p18"></div>
        <div class="std-wild-resource p20"></div>
        <div class="std-wild-resource p22"></div>
        <div class="std-wild-resource p24"></div>
        <div class="std-wild-resource p26"></div>
        <div class="std-wild-resource p28"></div>
        <div class="std-wild-resource p30"></div>
        <div class="wild-resource p30b"></div>
      </div>
    </div>

    <div
      id="main_board"
      class="board"
      :class="{'board--large': isLargeBoard, 'board--scene': cinematicTerrain}"
      @pointerover="inspectFromEvent"
      @pointerout="leaveSector"
      @focusin="inspectFromEvent"
      @focusout="leaveSector"
      @click="inspectFromEvent"
      @keydown="navigateAtlas">
      <BoardSpace
        v-for="curSpace in allSpacesOnMars"
        :key="curSpace.id"
        :space="curSpace"
        :aresExtension="expansions.ares"
        :tileView="tileView"
        :class="[atlasSpaceClasses(curSpace.id), ownershipClasses(curSpace)]"
        :tabindex="atlas ? (atlasTabStop === curSpace.id ? 0 : -1) : undefined"
        :role="atlas ? 'button' : undefined"
        :aria-label="atlas ? $t('Sector') + ' ' + (curSpace.a9 ?? curSpace.id) : undefined"
        :aria-describedby="inspectedSpace === curSpace.id ? sectorDescriptionId : undefined"
        data-test="board-space"
      />

      <svg id="board_legend" height="550" width="630" class="board-legend">
        <g v-for="(key, idx) in LEGENDS[boardName]" :key="idx" :transform="`translate(${key.position[0]}, ${key.position[1]})`">
          <text class="board-caption">
            <tspan y="0">{{ key.text[0] }}</tspan>
            <tspan :x="key.secondRowX || 0" y="1.1em">{{ key.text[1] }}</tspan>
          </text>
          <template v-if="key.line !== undefined">
            <line :x1="key.line.from[0]" :y1="key.line.from[1]" :x2="key.line.to[0]" :y2="key.line.to[1]" class="board-line" />
            <circle :cx="key.line.to[0]" :cy="key.line.to[1]" r="2" class="board-caption board_caption--black" />
          </template>
        </g>

        <template v-if="boardName === BoardName.THARSIS">
          <g id="ascraeus_mons" transform="translate(95, 192)">
            <text class="board-caption">
              <tspan dy="15">Ascraeus</tspan>
              <tspan x="12" dy="12">Mons</tspan>
            </text>
            <line x1="38" y1="20" x2="88" y2="26" class="board-line" />
            <text x="86" y="29" class="board-caption board_caption--black">●</text>
          </g>

          <g id="pavonis_mons" transform="translate(90, 230)">
            <text class="board-caption">
              <tspan dy="15">Pavonis</tspan>
              <tspan x="4" dy="12">Mons</tspan>
            </text>
            <line x1="35" y1="25" x2="72" y2="30" class="board-line" />
            <text x="66" y="33" class="board-caption board_caption--black">●</text>
          </g>

          <g id="arsia_mons" transform="translate(77, 275)">
            <text class="board-caption">
              <tspan dy="15">Arsia</tspan>
              <tspan x="-2" dy="12">Mons</tspan>
            </text>
            <line x1="25" y1="20" x2="49" y2="26" class="board-line" />
            <text x="47" y="29" class="board-caption board_caption--black">●</text>
          </g>

          <g id="tharsis_tholus" transform="translate(85, 175)">
            <text class="board-caption" dx="47">
              <tspan dy="-7">Tharsis</tspan>
              <tspan dy="12" x="48">Tholus</tspan>
            </text>
            <line y1="-3" x2="160" y2="2" class="board-line" x1="90" />
            <text x="158" y="5" class="board-caption board_caption--black">&#x25cf;</text>
          </g>

          <g id="noctis_city" transform="translate(85, 320)">
            <text class="board-caption">
              <tspan dy="15">Noctis</tspan>
              <tspan x="7" dy="12">City</tspan>
            </text>
            <line x1="30" y1="20" x2="140" y2="-20" class="board-line" />
            <text x="136" y="-18" class="board-caption board_caption--black">&#x25cf;</text>
          </g>
        </template>

        <template v-if="boardName === BoardName.ELYSIUM">
          <g id="elysium_mons" transform="translate(110, 190)">
            <text class="board-caption">
              <tspan dy="15">Elysium</tspan>
              <tspan x="8" dy="12">Mons</tspan>
            </text>
          </g>

          <g id="hecates_tholus" transform="translate(130, 150)">
            <text class="board-caption">
              <tspan dy="15">Hecates</tspan>
              <tspan x="3" dy="12">Tholus</tspan>
            </text>
          </g>

          <g id="arsia_mons" transform="translate(545, 272)">
            <text class="board-caption">
              <tspan dy="15">Arsia</tspan>
              <tspan x="0" dy="12">Mons</tspan>
            </text>
          </g>

          <g id="olympus_mons" transform="translate(505, 190)">
            <text class="board-caption">
              <tspan x="-5" dy="15">Olympus</tspan>
              <tspan x="4" dy="12">Mons</tspan>
            </text>
          </g>
        </template>

        <template v-if="boardName === BoardName.VASTITAS_BOREALIS_NOVA">
          <g id="hecates_tholus_vastitas_borealis_novus" transform="translate(270, 70)">
            <text class="board-caption">
              <tspan dy="15">Hecates</tspan>
              <tspan x="5" dy="12">Tholus</tspan>
            </text>
          </g>

          <g id="elysium_mons_vastitas_borealis_novus" transform="translate(480, 145)">
            <text class="board-caption">
              <tspan x="-5" dy="15">Elysium</tspan>
              <tspan x="4" dy="12">Mons</tspan>
            </text>
          </g>

          <g id="alba_mons_vastitas_borealis_novus" transform="translate(105, 230)">
            <text class="board-caption">
              <tspan x="0" dy="15">Alba</tspan>
              <tspan x="-1" dy="12">Mons</tspan>
            </text>
          </g>

          <g id="viking_2_vastitas_borealis_novus" transform="translate(530, 235)">
            <text class="board-caption">
              <tspan x="-5" dy="15">Viking 2</tspan>
            </text>
          </g>

          <g id="uranius_tholus_vastitas_borealis_novus" transform="translate(115, 370)">
            <text class="board-caption">
              <tspan x="0" dy="0">Uranius</tspan>
              <tspan x="2" dy="12">Tholus</tspan>
            </text>
          </g>

          <g id="viking_1_vastitas_borealis_novus" transform="translate(164, 445)">
            <text class="board-caption">
              <tspan x="-5" dy="15">Viking 1</tspan>
            </text>
          </g>
        </template>

        <template v-if="boardName === BoardName.ARABIA_TERRA">
          <g id="tikhonarov" transform="translate(487, 185)">
            <text class="board-caption">
              <tspan>Tikhonarov</tspan>
            </text>
            <line x1="15" y1="5" x2="3" y2="20" class="board-line" />
            <text x="1" y="22" class="board-caption board_caption--black">&#x25cf;</text>
          </g>
          <g id="ladon" transform="translate(286, 496)">
            <text class="board-caption">
              <tspan>Ladon</tspan>
            </text>
            <line x1="20" y1="-12" x2="17" y2="-70" class="board-line" />
            <text x="14" y="-68" class="board-caption board_caption--black">&#x25cf;</text>
          </g>
          <g id="flaugergues" transform="translate(480, 405)">
            <text class="board-caption">
              <tspan>Flaugergues</tspan>
            </text>
            <line x1="0" y1="2" x2="-15" y2="10" class="board-line" />
            <text x="-17" y="12" class="board-caption board_caption--black">&#x25cf;</text>
          </g>
          <g id="charybdis" transform="translate(455, 450)">
            <text class="board-caption">
              <tspan>Charybdis</tspan>
            </text>
            <line x1="0" y1="2" x2="-15" y2="10" class="board-line" />
            <text x="-17" y="12" class="board-caption board_caption--black">&#x25cf;</text>
          </g>
        </template>

        <template v-if="boardName === BoardName.AMAZONIS">
          <g id="albor_tholus" transform="translate(85, 175)">
            <text class="board-caption" dx="47">
              <tspan dy="-7">Albor</tspan>
              <tspan dy="12" x="48">Tholus</tspan>
            </text>
            <line y1="-3" x2="160" y2="2" class="board-line" x1="90" />
            <text x="158" y="5" class="board-caption board_caption--black">&#x25cf;</text>
          </g>
          <g id="anseris_mons" transform="translate(525, 330)">
            <text class="board-caption">
              <tspan>Anseris</tspan>
              <tspan x="5" dy="12">Mons</tspan>
            </text>
            <line x1="6" y1="-4" x2="-90" y2="-27" class="board-line" />
            <text x="-95" y="-25" class="board-caption board_caption--black">&#x25cf;</text>
          </g>
          <g id="pindus_mons" transform="translate(500, 370)">
            <text class="board-caption">
              <tspan>Pindus</tspan>
              <tspan x="5" dy="12">Mons</tspan>
            </text>
            <line x1="6" y1="-4" x2="-90" y2="-27" class="board-line" />
            <text x="-95" y="-25" class="board-caption board_caption--black">&#x25cf;</text>
          </g>
          <g id="ulysses_tholus" transform="translate(325, 496)">
            <text class="board-caption">
              <tspan>Ulysses</tspan>
              <tspan x="10" dy="12">Tholus</tspan>
            </text>
            <line x1="20" y1="-1" x2="4" y2="-109" class="board-line" />
            <text x="1" y="-107" class="board-caption board_caption--black">&#x25cf;</text>
          </g>
        </template>

        <template v-if="boardName === BoardName.VASTITAS_BOREALIS">
          <g id="elysium_mons_vastitas_borealis" transform="translate(410, 70)">
            <text class="board-caption">
              <tspan dy="15">Elysium</tspan>
              <tspan x="5" dy="12">Mons</tspan>
            </text>
          </g>
          <g id="alba_fossae" transform="translate(350, 70)">
            <line x1="20" y1="30" x2="41" y2="82" class="board-line" />
            <text x="39" y="85" class="board-caption board_caption--black">&#x25cf;</text>
            <text class="board-caption">
              <tspan dy="15">Alba</tspan>
              <tspan x="5" dy="12">Fossae</tspan>
            </text>
          </g>
          <g id="ceranius_fossae" transform="translate(80, 230)">
            <text class="board-caption">
              <tspan dy="15">Ceranius</tspan>
              <tspan x="9" dy="12">Fossae</tspan>
            </text>
            <line x1="35" y1="25" x2="72" y2="30" class="board-line" />
            <text x="66" y="33" class="board-caption board_caption--black">●</text>
          </g>
          <g id="alba_mons" transform="translate(105, 200)">
            <text class="board-caption">
              <tspan dy="15">Alba</tspan>
              <tspan x="9" dy="12">Mons</tspan>
            </text>
            <line x1="35" y1="25" x2="94" y2="31" class="board-line" />
            <text x="92" y="34" class="board-caption board_caption--black">●</text>
          </g>
        </template>

        <template v-if="boardName === BoardName.TERRA_CIMMERIA">
          <g id="albor_tholus" transform="translate(260, 70)">
            <text class="board-caption">
              <tspan dy="15">Albor</tspan>
              <tspan x="5" dy="12">Tholus</tspan>
            </text>
            <line x1="38" y1="26" x2="63" y2="38" class="board-line" />
            <text x="61" y="41" class="board-caption board_caption--black">●</text>
          </g>
          <g id="apollinaris_mons" transform="translate(500, 210)">
            <text class="board-caption">
              <tspan>Apollinaris</tspan>
              <tspan x="10" dy="12">Mons</tspan>
            </text>
            <line x1="15" y1="5" x2="-35" y2="30" class="board-line" />
            <text x="-40" y="33" class="board-caption board_caption--black">&#x25cf;</text>
          </g>
          <g id="hadriacus_mons" transform="translate(78, 320)">
            <text class="board-caption">
              <tspan dy="15">Hadriacus</tspan>
              <tspan x="24" dy="12">Mons</tspan>
            </text>
          </g>
          <g id="tyrrhenus_mons" transform="translate(80, 230)">
            <text class="board-caption">
              <tspan dy="15">Tyrrhenus</tspan>
              <tspan x="9" dy="12">Mons</tspan>
            </text>
            <line x1="35" y1="25" x2="72" y2="30" class="board-line" />
            <text x="66" y="33" class="board-caption board_caption--black">●</text>
          </g>
        </template>
      </svg>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import * as constants from '@/common/constants';
import {getGlobalParameterMaximums} from '@/common/boards/GlobalParameterMaximums';
import BoardSpace from '@/client/components/BoardSpace.vue';
import {AresData} from '@/common/ares/AresData';
import {SpaceModel} from '@/common/models/SpaceModel';
import {SpaceType} from '@/common/boards/SpaceType';
import {SpaceId} from '@/common/Types';
import {TileView} from '@/client/components/board/TileView';
import {BoardName} from '@/common/boards/BoardName';
import {LEGENDS} from '@/client/components/Legends';
import {Expansion} from '@/common/cards/GameModule';
import {SpaceName} from '@/common/boards/SpaceName';
import {SoundManager} from '@/client/utils/SoundManager';

const orbitalNames: Partial<Record<SpaceId, string>> = {
  [SpaceName.GANYMEDE_COLONY]: 'Ganymede Colony',
  [SpaceName.PHOBOS_SPACE_HAVEN]: 'Phobos Space Haven',
  [SpaceName.STANFORD_TORUS]: 'Stanford Torus',
  [SpaceName.LUNA_METROPOLIS]: 'Luna Metropolis',
  [SpaceName.DAWN_CITY]: 'Dawn City',
  [SpaceName.STRATOPOLIS]: 'Stratopolis',
  [SpaceName.MAXWELL_BASE]: 'Maxwell Base',
  'c74': 'Martian Transhipment Station',
  [SpaceName.CERES_SPACEPORT]: 'Ceres Spaceport',
  [SpaceName.DYSON_SCREENS]: 'Dyson Screens',
  [SpaceName.LUNAR_EMBASSY]: 'Lunar Embassy',
  [SpaceName.VENERA_BASE]: 'Venera Base',
};

function sectorForTarget(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>('[data_space_id]') : null;
}

class GlobalParamLevel {
  constructor(public value: number, public isActive: boolean, public strValue: string) {
  }
}

export default defineComponent({
  name: 'Board',
  emits: ['toggleTileView', 'inspectSpace', 'leaveSpace'],
  props: {
    atlas: Boolean,
    cinematicTerrain: Boolean,
    inspectedSpace: String as () => SpaceId | undefined,
    sectorDescriptionId: String,
    orbitDock: Object as () => HTMLElement | undefined,
    legalSpaces: Array as () => ReadonlyArray<SpaceId>,
    placedSpaces: Object as () => ReadonlySet<SpaceId>,
    spaces: {
      type: Array as () => ReadonlyArray<SpaceModel>,
      required: true,
    },
    venusScaleLevel: {
      type: Number,
      required: true,
    },
    altVenusBoard: {
      type: Boolean,
    },
    boardName: {
      type: String as () => BoardName,
      required: true,
    },
    oceans_count: {
      type: Number,
      default: 0,
    },
    oxygen_level: {
      type: Number,
      default: 0,
    },
    temperature: {
      type: Number,
      default: constants.MIN_TEMPERATURE,
    },
    expansions: {
      type: Object as () => Record<Expansion, boolean>,
      required: true,
    },
    aresData: {
      type: Object as () => AresData | undefined,
      default: undefined,
    },
    tileView: {
      type: String as () => TileView,
      default: 'show',
    },
  },
  components: {
    BoardSpace,
  },
  methods: {
    ownershipClasses(space: SpaceModel): string[] {
      if (!this.atlas || this.tileView !== 'show' || space.color === undefined || space.color === 'bronze' || space.color === 'neutral') {
        return [];
      }
      const classes = ['atlas-owned', `atlas-owner--${space.color}`];
      if (space.coOwner !== undefined && space.coOwner !== space.color) {
        classes.push(`atlas-co-owner--${space.coOwner}`);
      }
      return classes;
    },
    orbitalName(space: SpaceModel): string {
      return orbitalNames[space.id] ?? space.a9 ?? space.id;
    },
    atlasSpaceClasses(id: SpaceId) {
      return {
        'atlas-sector--inspected': this.atlas && this.inspectedSpace === id,
        'atlas-sector--legal': this.legalSpaces?.includes(id),
        'atlas-sector--placed': this.placedSpaces?.has(id),
      };
    },
    inspectFromEvent(event: MouseEvent | FocusEvent) {
      if (!this.atlas || (event.type === 'pointerover' && 'pointerType' in event && event.pointerType === 'touch')) {
        return;
      }
      const sector = sectorForTarget(event.target);
      if (sector === null) {
        if (event.type === 'click') {
          this.$emit('leaveSpace');
        }
        return;
      }
      if (sector === sectorForTarget(event.relatedTarget)) {
        return;
      }
      this.$emit('inspectSpace', sector.getAttribute('data_space_id') as SpaceId, sector);
      if (event.type === 'click') {
        SoundManager.mission('sector');
      }
    },
    leaveSector(event: PointerEvent | FocusEvent) {
      if (!this.atlas || ('pointerType' in event && event.pointerType === 'touch')) {
        return;
      }
      const sector = sectorForTarget(event.target);
      if (sector === null || sector === sectorForTarget(event.relatedTarget)) {
        return;
      }
      if (event.type === 'pointerout' && sector.matches(':focus-visible')) {
        return;
      }
      this.$emit('leaveSpace', sector);
    },
    navigateAtlas(event: KeyboardEvent) {
      if (!this.atlas || !(event.target instanceof HTMLElement) || !event.target.hasAttribute('data_space_id')) {
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.target.click();
        return;
      }
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
        return;
      }
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      event.preventDefault();
      const region = event.currentTarget as HTMLElement;
      const sectors = Array.from(region.querySelectorAll<HTMLElement>(':scope > [data_space_id]'));
      const index = sectors.indexOf(event.target);
      sectors[index + direction]?.focus({preventScroll: true});
    },
    getValuesForParameter(targetParameter: string): Array<GlobalParamLevel> {
      const values = [];
      let startValue: number;
      let endValue: number;
      let step: number;
      let curValue: number;
      let strValue: string;

      switch (targetParameter) {
      case 'oxygen':
        startValue = constants.MIN_OXYGEN_LEVEL;
        endValue = this.globalParameterMaximums.oxygen;
        step = 1;
        curValue = this.oxygen_level;
        break;
      case 'temperature':
        startValue = constants.MIN_TEMPERATURE;
        endValue = this.globalParameterMaximums.temperature;
        step = 2;
        curValue = this.temperature;
        break;
      case 'venus':
        startValue = constants.MIN_VENUS_SCALE;
        endValue = constants.MAX_VENUS_SCALE;
        step = 2;
        curValue = this.venusScaleLevel;
        break;
      default:
        throw new Error('Wrong parameter to get values from: ' + targetParameter);
      }

      // Above 30%, the Venus scale moves 1% per step (Amazonis Planitia goes to 33%).
      if (targetParameter === 'venus') {
        for (let value = this.globalParameterMaximums.venus; value > endValue; value--) {
          values.push(new GlobalParamLevel(value, value === curValue, value.toString()));
        }
      }
      for (let value = endValue; value >= startValue; value -= step) {
        strValue = (targetParameter === 'temperature' && value > 0) ? '+'+value : value.toString();
        values.push(
          new GlobalParamLevel(value, value === curValue, strValue),
        );
      }
      return values;
    },
    getScaleCSS(paramLevel: GlobalParamLevel): string {
      let css = 'global-numbers-value val-' + paramLevel.value + ' ';
      if (paramLevel.isActive) {
        css += 'val-is-active';
      }
      return css;
    },
    oceansValue() {
      const oceans_count = this.oceans_count || 0;
      const leftover = this.globalParameterMaximums.oceans - oceans_count;
      if (leftover === 0) {
        return '<img width="26" src="assets/misc/circle-checkmark.png" class="board-ocean-checkmark" :alt="$t(\'Completed!\')">';
      } else {
        return `${oceans_count}/${this.globalParameterMaximums.oceans}`;
      }
    },
  },
  computed: {
    orbitalSpaces(): Array<SpaceModel> {
      return this.spaces.filter((space) => space.spaceType === SpaceType.COLONY);
    },
    atlasTabStop(): SpaceId | undefined {
      return this.allSpacesOnMars.find((space) => space.id === this.inspectedSpace)?.id ?? this.allSpacesOnMars[0]?.id;
    },
    // The per-map maximum values of the global parameters (the larger maps raise them).
    globalParameterMaximums() {
      return getGlobalParameterMaximums(this.boardName);
    },
    // The larger map needs a bigger board container.
    isLargeBoard(): boolean {
      return this.boardName === BoardName.AMAZONIS_PLANITIA;
    },
    BoardName(): typeof BoardName {
      return BoardName;
    },
    LEGENDS(): typeof LEGENDS {
      return LEGENDS;
    },
    SpaceName(): typeof SpaceName {
      return SpaceName;
    },
    constants(): typeof constants {
      return constants;
    },
    allSpacesOnMars(): Array<SpaceModel> {
      return this.spaces
        .filter((s) => s.spaceType !== SpaceType.COLONY)
        .toSorted((space1, space2) => parseInt(space1.id) - parseInt(space2.id));
    },
    gameBoardClassName(): string {
      return [
        'board-cont',
        this.expansions.venus ? 'board-with-venus' : 'board-without-venus',
        this.isLargeBoard ? 'board-cont--large' : '',
        this.atlas ? 'atlas-board' : '',
      ].join(' ');
    },
  },
});
</script>
