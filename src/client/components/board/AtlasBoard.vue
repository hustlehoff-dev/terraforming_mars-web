<template>
  <div class="atlas-stage" :class="{'atlas-stage--tracks': showTracks, 'atlas-stage--has-orbit': hasOrbitalSpaces, 'atlas-stage--complete': game.isTerraformed}" @keydown.esc="hideTooltip()">
    <span v-if="orbitLayout" class="atlas-stage__shuttle" aria-hidden="true"></span>
    <span v-if="orbitLayout && game.isTerraformed" class="atlas-stage__completion" aria-hidden="true"></span>
    <div class="atlas-stage__map">
      <Board
        id="shortkey-board"
        :spaces="spaces"
        :expansions="game.gameOptions.expansions"
        :venusScaleLevel="game.venusScaleLevel"
        :boardName="game.gameOptions.boardName"
        :oceans_count="game.oceans"
        :oxygen_level="game.oxygenLevel"
        :temperature="game.temperature"
        :altVenusBoard="game.gameOptions.altVenusBoard"
        :aresData="game.aresData"
        :tileView="tileView"
        :inspectedSpace="inspectedSpace"
        :sectorDescriptionId="tooltipPosition ? sectorTooltipId : undefined"
        :orbitDock="orbitDock"
        :legalSpaces="activePlacement?.spaces"
        :placedSpaces="placedSpaces"
        atlas
        @inspectSpace="inspectSpace"
        @leaveSpace="hideTooltip"
        @toggleTileView="$emit('toggleTileView')" />
    </div>

    <div v-if="hasOrbitalSpaces" ref="orbitDock" class="atlas-orbit" :aria-label="$t('Orbital stations')"></div>

    <aside class="atlas-inspector" :aria-label="$t('Board')">
      <div class="atlas-inspector__tools">
        <button type="button" :aria-pressed="showTracks" @click="showTracks = !showTracks" v-i18n>Tracks</button>
        <button type="button" @click="$emit('toggleTileView')">{{ $t(nextView + ' tiles') }}</button>
      </div>
      <div v-if="activePlacement" class="atlas-inspector__readout" aria-live="polite">
        <div class="atlas-inspector__action" :class="{'atlas-inspector__action--ready': canPlace}">
          <span class="atlas-inspector__caption" v-i18n>Current action</span>
          <p>{{ $t(activePlacement.title) }}</p>
          <small v-if="canPlace" v-i18n>Select this sector to place the tile.</small>
          <small v-else v-i18n>Choose a highlighted sector.</small>
        </div>
      </div>
    </aside>

    <Teleport to="body">
      <div
        v-if="sector && tooltipAnchor"
        :id="sectorTooltipId"
        ref="sectorTooltip"
        class="atlas-tooltip"
        role="tooltip"
        :style="tooltipPosition">
        <p class="atlas-tooltip__sector">
          <span v-i18n>Sector</span>
          <strong>{{ sector.a9 ?? sector.id }}</strong>
        </p>
        <p class="atlas-tooltip__terrain" v-i18n>{{ terrain }}</p>
        <div v-if="bonuses.length" class="atlas-tooltip__bonuses">
          <span v-i18n>Placement bonus</span>
          <ul>
            <li v-for="bonus in bonuses" :key="bonus.label">+{{ bonus.count }} {{ $t(bonus.label) }}</li>
          </ul>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script lang="ts">
import {CSSProperties, defineComponent, inject, ref, useId} from 'vue';
import Board from '@/client/components/Board.vue';
import {mapPlacementKey} from '@/client/components/board/MapPlacement';
import {nextTileView, TileView} from '@/client/components/board/TileView';
import {spacesById} from '@/client/utils/spacesById';
import {scrollToSpace} from '@/client/utils/boardScroll';
import {SpaceBonus} from '@/common/boards/SpaceBonus';
import {SpaceType} from '@/common/boards/SpaceType';
import {SelectSpaceModel} from '@/common/models/PlayerInputModel';
import {SpaceModel} from '@/common/models/SpaceModel';
import {GameModel} from '@/common/models/GameModel';
import {tileTypeToString} from '@/common/TileType';
import {SpaceId} from '@/common/Types';
import {SoundManager} from '@/client/utils/SoundManager';

const terrainNames: Record<SpaceType, string> = {
  [SpaceType.LAND]: 'Land',
  [SpaceType.OCEAN]: 'Ocean reserve',
  [SpaceType.COLONY]: 'Colony',
  [SpaceType.LUNAR_MINE]: 'Lunar mine',
  [SpaceType.COVE]: 'Cove',
  [SpaceType.RESTRICTED]: 'Restricted area',
  [SpaceType.DEFLECTION_ZONE]: 'Deflection zone',
};

export default defineComponent({
  name: 'AtlasBoard',
  components: {Board},
  emits: ['toggleTileView'],
  props: {
    orbitLayout: Boolean,
    game: {
      type: Object as () => GameModel,
      required: true,
    },
    tileView: {
      type: String as () => TileView,
      required: true,
    },
  },
  setup() {
    return {mapPlacement: inject(mapPlacementKey, undefined)?.input, sectorTooltipId: useId(), orbitDock: ref<HTMLElement>()};
  },
  data() {
    return {
      inspectedSpace: undefined as SpaceId | undefined,
      tooltipAnchor: undefined as HTMLElement | undefined,
      tooltipPosition: undefined as CSSProperties | undefined,
      showTracks: false,
      placedSpaces: new Set<SpaceId>(),
      placementTimer: undefined as number | undefined,
    };
  },
  computed: {
    hasOrbitalSpaces(): boolean {
      return this.orbitLayout && this.spaces.some((space) => space.spaceType === SpaceType.COLONY);
    },
    spaces(): ReadonlyArray<SpaceModel> {
      return this.game.spaces;
    },
    nextView(): TileView {
      return nextTileView(this.tileView);
    },
    sector(): SpaceModel | undefined {
      return this.inspectedSpace === undefined ? undefined : spacesById(this.spaces).get(this.inspectedSpace);
    },
    terrain(): string {
      if (this.sector === undefined) {
        return '';
      }
      const {tileType, spaceType} = this.sector;
      return tileType === undefined ? terrainNames[spaceType] : tileTypeToString[tileType];
    },
    activePlacement(): SelectSpaceModel | undefined {
      const byId = spacesById(this.spaces);
      return this.mapPlacement?.spaces.some((id) => byId.has(id)) ? this.mapPlacement : undefined;
    },
    canPlace(): boolean {
      return this.inspectedSpace !== undefined && (this.activePlacement?.spaces.includes(this.inspectedSpace) ?? false);
    },
    bonuses(): Array<{label: string, count: number}> {
      if (this.sector === undefined || this.sector.tileType !== undefined || this.sector.cube !== undefined) {
        return [];
      }
      const counts = new Map<SpaceBonus, number>();
      for (const bonus of this.sector.bonus) {
        if (bonus === SpaceBonus._RESTRICTED || bonus === SpaceBonus._TEMPERATURE_3MC) {
          continue;
        }
        counts.set(bonus, (counts.get(bonus) ?? 0) + 1);
      }
      return Array.from(counts, ([bonus, count]) => ({label: SpaceBonus.toString(bonus), count}));
    },
  },
  watch: {
    sector: {flush: 'post', handler: 'positionTooltip'},
    showTracks: {flush: 'post', handler: 'positionTooltip'},
    spaces(next: ReadonlyArray<SpaceModel>, previous: ReadonlyArray<SpaceModel>) {
      const before = spacesById(previous);
      const placed = next.filter((space) => space.tileType !== undefined && space.tileType !== before.get(space.id)?.tileType);
      if (placed.length > 0) {
        for (const space of placed) {
          this.placedSpaces.add(space.id);
        }
        SoundManager.mission('placement');
        window.clearTimeout(this.placementTimer);
        this.placementTimer = window.setTimeout(() => this.placedSpaces.clear(), 950);
      }
    },
    activePlacement: {
      flush: 'post',
      handler(input: SelectSpaceModel | undefined) {
        const sector = input?.spaces.find((id) => spacesById(this.spaces).has(id));
        if (sector !== undefined) {
          if (!this.canPlace) {
            this.hideTooltip();
            this.inspectedSpace = sector;
          }
          scrollToSpace(sector);
        }
      },
    },
  },
  mounted() {
    window.addEventListener('resize', this.positionTooltip);
    window.addEventListener('scroll', this.positionTooltip, true);
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.positionTooltip);
    window.removeEventListener('scroll', this.positionTooltip, true);
    window.clearTimeout(this.placementTimer);
  },
  methods: {
    inspectSpace(id: SpaceId, anchor?: HTMLElement) {
      if (spacesById(this.spaces).has(id)) {
        this.inspectedSpace = id;
        this.tooltipAnchor = anchor ?? (Array.from(this.$el.querySelectorAll('[data_space_id]')) as HTMLElement[])
          .find((element) => element.getAttribute('data_space_id') === id);
        this.$nextTick(this.positionTooltip);
      }
    },
    hideTooltip(anchor?: HTMLElement) {
      if (anchor === undefined || this.tooltipAnchor === anchor) {
        this.tooltipAnchor = undefined;
        this.tooltipPosition = undefined;
        this.inspectedSpace = undefined;
      }
    },
    positionTooltip() {
      const tooltip = this.$refs.sectorTooltip as HTMLElement | undefined;
      if (this.tooltipAnchor === undefined || tooltip === undefined) {
        return;
      }

      const gap = 8;
      const anchor = this.tooltipAnchor.getBoundingClientRect();
      const {width, height} = tooltip.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
      const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
      if (anchor.bottom <= 0 || anchor.top >= viewportHeight || anchor.right <= 0 || anchor.left >= viewportWidth) {
        this.tooltipPosition = undefined;
        return;
      }

      const right = anchor.right + gap;
      const left = anchor.left - width - gap;
      const preferredLeft = right + width <= viewportWidth - gap || left < gap ? right : left;
      const centeredTop = anchor.top + (anchor.height - height) / 2;
      this.tooltipPosition = {
        left: Math.max(gap, Math.min(preferredLeft, viewportWidth - width - gap)) + 'px',
        top: Math.max(gap, Math.min(centeredTop, viewportHeight - height - gap)) + 'px',
        visibility: 'visible',
      };
    },
  },
});
</script>
