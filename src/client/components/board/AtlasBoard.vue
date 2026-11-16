<template>
  <div class="atlas-stage" :class="{'atlas-stage--tracks': showTracks, 'atlas-stage--has-orbit': hasOrbitalSpaces, 'atlas-stage--complete': game.isTerraformed, 'atlas-stage--placing': activePlacement !== undefined}" @keydown.esc="hideTooltip()">
    <span v-if="orbitLayout" class="atlas-stage__shuttle" aria-hidden="true"></span>
    <span v-if="orbitLayout && game.isTerraformed" class="atlas-stage__completion" aria-hidden="true"></span>
    <MarsSurface ref="marsSurface" :enabled="orbitLayout" :tracks="showTracks" :large="game.gameOptions.boardName === BoardName.AMAZONIS_PLANITIA"
      :spaces="spaces" :legalSpaces="activePlacement?.spaces" :inspectedSpace="inspectedSpace" :orbitDock="orbitDock" :climate="climate" @cameraChanged="refreshCameraTooltip">
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
          :cinematicTerrain="orbitLayout && !showTracks"
          atlas
          @inspectSpace="inspectSpace"
          @leaveSpace="hideTooltip"
          @toggleTileView="$emit('toggleTileView')" />
      </div>
    </MarsSurface>

    <div v-if="orbitLayout && !showTracks" class="mars-camera" role="group" :aria-label="$t('Map camera')" :title="$t('Arrows move the camera, + and - zoom, 0 resets')"
      @keydown.left.prevent="moveCamera(80, 0)" @keydown.right.prevent="moveCamera(-80, 0)"
      @keydown.up.prevent="moveCamera(0, 60)" @keydown.down.prevent="moveCamera(0, -60)">
      <button type="button" :aria-label="$t('Zoom out')" :title="$t('Zoom out')" @click="zoomCamera(1 / 1.25)">−</button>
      <button type="button" :aria-label="$t('Reset camera')" :title="$t('Reset camera')" @click="resetCamera">⌖</button>
      <button type="button" :aria-label="$t('Zoom in')" :title="$t('Zoom in')" @click="zoomCamera(1.25)">+</button>
    </div>

    <section v-if="hasOrbitalSpaces" class="atlas-orbit" :aria-label="$t('Orbital stations')">
      <h2 class="atlas-orbit__title" v-i18n>Orbital stations</h2>
      <div ref="orbitDock"></div>
    </section>

    <aside class="atlas-inspector" :aria-label="$t('Board')">
      <div class="atlas-inspector__tools">
        <button type="button" :aria-pressed="showTracks" @click="showTracks = !showTracks" v-i18n>Tracks</button>
        <MissionColonies :colonies="game.colonies" :players="players" :trade-input="tradeInput" @trade="(response) => $emit('trade-colonies', response)" />
        <button type="button" @click="$emit('toggleTileView')">{{ $t(nextView + ' tiles') }}</button>
      </div>
    </aside>
    <!-- A tile was placed: its "+" icon pops up in the middle of the screen for a moment. -->
    <Teleport to="body">
      <div v-if="tilePops.length" class="tile-pops" aria-hidden="true">
        <span v-for="pop in tilePops" :key="pop.id" class="tile-pop" :style="{'--pop-offset': pop.offset}">
          <b>+</b><img :src="pop.img" alt="">
        </span>
      </div>
    </Teleport>
    <MissionPlacementBanner v-if="activePlacement" :title="activePlacement.title" :ready="canPlace" :cancel="cancelPlacement" />

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
          <strong>{{ sector.a9 ?? sector.id }}<template v-if="landmark"> · {{ $t(landmark) }}</template></strong>
        </p>
        <p class="atlas-tooltip__terrain" v-i18n>{{ terrain }}</p>
        <dl class="atlas-tooltip__facts">
          <dt v-i18n>Owner</dt>
          <dd>{{ owners.length ? owners.join(' / ') : $t('Unowned') }}</dd>
          <template v-if="sector.boardVictoryPoints !== undefined && owners.length">
            <dt v-i18n>Board points</dt>
            <dd>{{ sector.boardVictoryPoints }} {{ $t('VP') }}</dd>
          </template>
          <template v-if="sector.adjacentGreenery !== undefined">
            <dt v-i18n>Adjacent greenery</dt>
            <dd>{{ sector.adjacentGreenery }}</dd>
          </template>
          <template v-if="sector.adjacentOceans">
            <dt v-i18n>Adjacent oceans</dt>
            <dd>{{ sector.adjacentOceans }}</dd>
          </template>
          <template v-if="sector.tileCard && sector.tileCard !== terrain">
            <dt v-i18n>Source card</dt>
            <dd>{{ $t(sector.tileCard) }}</dd>
          </template>
        </dl>
        <p v-if="tileEffect" class="atlas-tooltip__effect">{{ $t(tileEffect) }}</p>
        <div v-if="bonuses.length" class="atlas-tooltip__bonuses">
          <span>{{ $t(sector.tileType === undefined ? 'Placement bonus' : 'Original placement bonus') }}</span>
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
import {sectorName} from '@/client/components/Legends';
import MarsSurface from '@/client/components/board/MarsSurface.vue';
import MissionPlacementBanner from '@/client/components/board/MissionPlacementBanner.vue';
import MissionColonies from '@/client/components/board/MissionColonies.vue';
import {mapPlacementKey} from '@/client/components/board/MapPlacement';
import {nextTileView, TileView} from '@/client/components/board/TileView';
import {spacesById} from '@/client/utils/spacesById';
import {scrollToSpace} from '@/client/utils/boardScroll';
import {SpaceBonus} from '@/common/boards/SpaceBonus';
import {SpaceType} from '@/common/boards/SpaceType';
import {SelectSpaceModel} from '@/common/models/PlayerInputModel';
import {SpaceModel} from '@/common/models/SpaceModel';
import {GameModel} from '@/common/models/GameModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {TileType, tileTypeToString} from '@/common/TileType';
import {getCard} from '@/client/cards/ClientCardManifest';
import {SpaceId} from '@/common/Types';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {SoundManager} from '@/client/utils/SoundManager';
import {BoardName} from '@/common/boards/BoardName';
import {getGlobalParameterMaximums} from '@/common/boards/GlobalParameterMaximums';
import {MIN_TEMPERATURE} from '@/common/constants';

const terrainNames: Record<SpaceType, string> = {
  [SpaceType.LAND]: 'Land',
  [SpaceType.OCEAN]: 'Ocean reserve',
  [SpaceType.COLONY]: 'Colony',
  [SpaceType.LUNAR_MINE]: 'Lunar mine',
  [SpaceType.COVE]: 'Cove',
  [SpaceType.RESTRICTED]: 'Restricted area',
  [SpaceType.DEFLECTION_ZONE]: 'Deflection zone',
};

let popId = 0;

function tileImage(tile: TileType | undefined): string {
  switch (tile) {
  case TileType.GREENERY:
    return 'assets/tiles/greenery.png';
  case TileType.OCEAN:
    return 'assets/tiles/ocean.png';
  case TileType.CITY:
  case TileType.CAPITAL:
    return 'assets/tiles/city.png';
  default:
    return 'assets/tiles/special.png';
  }
}

export default defineComponent({
  name: 'AtlasBoard',
  components: {Board, MarsSurface, MissionPlacementBanner, MissionColonies},
  emits: ['toggleTileView', 'trade-colonies'],
  props: {
    orbitLayout: Boolean,
    tradeInput: {type: Object as () => PlayerInputModel | undefined, default: undefined},
    players: {type: Array as () => ReadonlyArray<PublicPlayerModel>, default: () => []},
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
    const placement = inject(mapPlacementKey, undefined);
    return {BoardName, mapPlacement: placement?.input, cancelPlacement: placement?.requestCancel, sectorTooltipId: useId(), orbitDock: ref<HTMLElement>()};
  },
  data() {
    return {
      inspectedSpace: undefined as SpaceId | undefined,
      tooltipAnchor: undefined as HTMLElement | undefined,
      tooltipPosition: undefined as CSSProperties | undefined,
      showTracks: false,
      placedSpaces: new Set<SpaceId>(),
      tilePops: [] as Array<{id: number, img: string, offset: number}>,
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
    landmark(): string | undefined {
      return this.sector && sectorName(this.game.gameOptions.boardName, this.sector.id);
    },
    terrain(): string {
      if (this.sector === undefined) {
        return '';
      }
      const {tileType, spaceType} = this.sector;
      return tileType === undefined ? terrainNames[spaceType] : tileTypeToString[tileType];
    },
    owners(): string[] {
      const colors = new Set([this.sector?.color, this.sector?.coOwner]);
      return this.players.filter((player) => colors.has(player.color)).map((player) => player.name);
    },
    tileEffect(): string | undefined {
      const card = this.sector?.tileCard;
      const description = card === undefined ? undefined : getCard(card)?.metadata.description;
      if (description) {
        return typeof description === 'string' ? description : description.text;
      }
      switch (this.sector?.tileType) {
      case TileType.GREENERY: return 'Raises oxygen when placed. Worth 1 VP to its owner.';
      case TileType.CITY: return 'Worth 1 VP per adjacent greenery, regardless of its owner.';
      case TileType.OCEAN: return 'Counts toward the ocean goal. Adjacent placements earn M€.';
      default: return undefined;
      }
    },
    /** Global parameters as 0..1 for the planet's climate. */
    climate(): {temperature: number, oxygen: number, oceans: number} {
      const max = getGlobalParameterMaximums(this.game.gameOptions.boardName);
      const share = (value: number, min: number, top: number) => Math.max(0, Math.min(1, (value - min) / Math.max(1, top - min)));
      return {
        temperature: share(this.game.temperature, MIN_TEMPERATURE, max.temperature),
        oxygen: share(this.game.oxygenLevel, 0, max.oxygen),
        oceans: share(this.game.oceans, 0, max.oceans),
      };
    },
    activePlacement(): SelectSpaceModel | undefined {
      const byId = spacesById(this.spaces);
      return this.mapPlacement?.spaces.some((id) => byId.has(id)) ? this.mapPlacement : undefined;
    },
    canPlace(): boolean {
      return this.inspectedSpace !== undefined && (this.activePlacement?.spaces.includes(this.inspectedSpace) ?? false);
    },
    bonuses(): Array<{label: string, count: number}> {
      if (this.sector === undefined) {
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
        this.popTiles(placed);
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
    // Camera keys work wherever the focus is, except in text fields and open dialogs.
    window.addEventListener('keydown', this.cameraKeys);
    window.addEventListener('resize', this.positionTooltip);
    window.addEventListener('scroll', this.positionTooltip, true);
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.cameraKeys);
    window.removeEventListener('resize', this.positionTooltip);
    window.removeEventListener('scroll', this.positionTooltip, true);
    window.clearTimeout(this.placementTimer);
  },
  methods: {
    /** Shows a "+" tile icon in the centre of the screen for each placed tile. */
    popTiles(placed: ReadonlyArray<SpaceModel>) {
      const images = placed.map((space) => tileImage(space.tileType));
      images.forEach((img, index) => {
        const id = popId++;
        this.tilePops = [...this.tilePops, {id, img, offset: index - (images.length - 1) / 2}];
        window.setTimeout(() => {
          this.tilePops = this.tilePops.filter((pop) => pop.id !== id);
        }, 1300);
      });
    },
    cameraKeys(event: KeyboardEvent) {
      if (!this.orbitLayout || this.showTracks || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (event.defaultPrevented || target?.closest('input, textarea, select, [contenteditable="true"], dialog[open]') || document.querySelector('dialog[open]')) {
        return;
      }
      if (event.key === '+' || event.key === '=') {
        this.zoomCamera(1.25);
      } else if (event.key === '-' || event.key === '_') {
        this.zoomCamera(1 / 1.25);
      } else if (event.key === '0' || event.key === 'Home') {
        this.resetCamera();
      } else {
        return;
      }
      event.preventDefault();
    },
    moveCamera(x: number, y: number) {
      (this.$refs.marsSurface as InstanceType<typeof MarsSurface> | undefined)?.pan(x, y);
    },
    zoomCamera(factor: number) {
      (this.$refs.marsSurface as InstanceType<typeof MarsSurface> | undefined)?.zoomBy(factor);
    },
    resetCamera() {
      (this.$refs.marsSurface as InstanceType<typeof MarsSurface> | undefined)?.resetCamera();
    },
    refreshCameraTooltip() {
      if (this.tooltipAnchor) {
        this.$nextTick(this.positionTooltip);
      }
    },
    inspectSpace(id: SpaceId, anchor?: HTMLElement) {
      if (spacesById(this.spaces).has(id)) {
        this.inspectedSpace = id;
        this.tooltipAnchor = anchor ?? (Array.from(this.$el.querySelectorAll('[data_space_id]')) as HTMLElement[])
          .find((element) => element.getAttribute('data_space_id') === id);
        if (this.tooltipAnchor && (anchor === undefined || anchor.matches(':focus-visible'))) {
          (this.$refs.marsSurface as InstanceType<typeof MarsSurface> | undefined)?.reveal(this.tooltipAnchor);
        }
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
      const orbit = this.tooltipAnchor.closest('.atlas-orbit')?.getBoundingClientRect();
      const aboveOrbit = orbit !== undefined && orbit.top >= height + 2 * gap;
      const tooltipLeft = aboveOrbit ? anchor.left + (anchor.width - width) / 2 : preferredLeft;
      const tooltipTop = aboveOrbit ? orbit.top - height - gap : centeredTop;
      this.tooltipPosition = {
        left: Math.max(gap, Math.min(tooltipLeft, viewportWidth - width - gap)) + 'px',
        top: Math.max(gap, Math.min(tooltipTop, viewportHeight - height - gap)) + 'px',
        visibility: 'visible',
      };
    },
  },
});
</script>

<style lang="less">
.tile-pops {
  position: fixed;
  z-index: 34;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.tile-pop {
  grid-area: 1 / 1;
  display: flex;
  align-items: center;
  gap: 4px;
  translate: calc(var(--pop-offset, 0) * 150px) 0;
  animation: tile-pop 1.3s cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
  filter: drop-shadow(0 0 18px #ffffffaa) drop-shadow(0 10px 20px #000c);

  b {
    color: #fff;
    font-size: 4rem;
    font-weight: 900;
    line-height: 1;
    text-shadow: 0 0 12px #000, 0 2px 0 #000;
  }

  img {
    width: 110px;
    height: 110px;
    object-fit: contain;
  }
}

@keyframes tile-pop {
  0% { opacity: 0; transform: scale(0.4); }
  18% { opacity: 1; transform: scale(1.15); }
  30% { transform: scale(1); }
  75% { opacity: 1; transform: scale(1) translateY(0); }
  100% { opacity: 0; transform: scale(0.9) translateY(-40px); }
}

@media (prefers-reduced-motion: reduce) {
  .tile-pop {
    animation-duration: 0.01s;
  }
}
</style>

