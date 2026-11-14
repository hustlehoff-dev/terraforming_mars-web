<template>
  <div class="select_space_cont">
    <Teleport to="body">
      <ConfirmDialog
        message="Place your tile here?"
        :enableDontShowAgainCheckbox="true"
        ref="confirmation"
        @accept="confirmPlacement"
        @dismiss="cancelPlacement"
        @hide="hideDialog" />
    </Teleport>
    <div v-if="showtitle" class="wf-select-space">
      {{ $t(playerinput.title) }}
      <GoToMap :playerinput="playerinput" />
    </div>
    <div v-if="warning" class="nes-container is-rounded">
      <span class="nes-text is-warning" v-i18n>{{ warning }}</span>
      <GoToMap :playerinput="playerinput" />
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, inject, onBeforeUnmount, watch} from 'vue';
import {SelectSpaceModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {getPreferences, PreferencesManager} from '@/client/utils/PreferencesManager';
import {SelectSpaceResponse} from '@/common/inputs/InputResponse';
import ConfirmDialog from '@/client/components/common/ConfirmDialog.vue';
import GoToMap from '@/client/components/waitingFor/GoToMap.vue';
import {SpaceId} from '@/common/Types';
import {mapPlacementKey} from '@/client/components/board/MapPlacement';


type Refs = {
  confirmation: InstanceType<typeof ConfirmDialog>;
};

type DataModel = {
  selectedTile: HTMLElement | undefined,
  spaceId: SpaceId | undefined;
  warning: string | undefined;
};

export default defineComponent({
  name: 'SelectSpace',
  setup(props) {
    const mapPlacement = inject(mapPlacementKey, undefined);
    let unregister: (() => void) | undefined;
    function clearPlacement() {
      unregister?.();
      unregister = undefined;
    }
    const register = mapPlacement?.register;
    if (register) {
      watch([() => props.playerinput, () => props.playerView], ([input]) => {
        clearPlacement();
        unregister = register(input);
      }, {immediate: true});
    }
    onBeforeUnmount(clearPlacement);
    return {mapPlacement};
  },
  props: {
    playerView: {
      type: Object as () => PlayerViewModel,
      required: true,
    },
    playerinput: {
      type: Object as () => SelectSpaceModel,
      required: true,
    },
    onsave: {
      type: Function as unknown as () => (out: SelectSpaceResponse) => void | Promise<boolean>,
      required: true,
    },
    showsave: {
      type: Boolean,
      required: true,
    },
    showtitle: {
      type: Boolean,
      required: true,
    },
  },
  data(): DataModel {
    return {
      selectedTile: undefined,
      spaceId: undefined,
      warning: undefined,
    };
  },
  components: {
    ConfirmDialog,
    GoToMap,
  },
  computed: {
    spaces(): ReadonlySet<SpaceId> {
      return new Set(this.playerinput.spaces);
    },
    typedRefs(): Refs {
      return this.$refs as unknown as Refs;
    },
  },
  methods: {
    animateSpace(tile: Element, activate: boolean) {
      if (activate) {
        tile.classList.add('board-space--available');
      } else {
        tile.classList.remove('board-space--available');
      }
    },
    animateSpaces(tiles: Array<Element>) {
      tiles.forEach((tile: Element) => {
        const spaceId = tile.getAttribute('data_space_id') as SpaceId;
        if (spaceId !== null && this.spaces.has(spaceId)) {
          this.animateSpace(tile, true);
        }
      });
    },
    cancelPlacement() {
      if (this.selectedTile === undefined) {
        throw new Error('unexpected, no tile selected!');
      }
      this.animateSpace(this.selectedTile, false);
      this.animateSpaces(this.getSelectableSpaces());
    },
    confirmPlacement() {
      if (this.selectedTile === undefined) {
        throw new Error('unexpected, no tile selected!');
      }
      const spaceId = this.selectedTile.getAttribute('data_space_id') as SpaceId;
      if (spaceId === null) {
        throw new Error('unexpected, space has no id');
      }
      this.spaceId = spaceId;
      this.selectedTile.classList.add('board-space--selected');
      this.saveData();
    },
    disableAnimation() {
      const tiles = this.getSelectableSpaces();
      tiles.forEach((tile) => {
        tile.classList.remove('board-space--available', 'board-space--selected');
      });
    },
    getSelectableSpaces(): Array<HTMLElement> {
      const spaces: Array<HTMLElement> = [];

      const regions = ['main_board', 'moon_board', 'colony_spaces', 'moon_board_outer_spaces'];
      for (const region of regions) {
        const board = document.getElementById(region);
        if (board !== null) {
          const array = board.getElementsByClassName('board-space-selectable');
          for (let i = 0, length = array.length; i < length; i++) {
            spaces.push(array[i] as HTMLElement);
          }
        }
      }

      return spaces;
    },
    hideDialog(hide: boolean) {
      PreferencesManager.INSTANCE.set('hide_tile_confirmation', hide);
    },
    onBoardClick(event: MouseEvent) {
      if (this.spaceId !== undefined || (this.mapPlacement && this.mapPlacement.input.value !== this.playerinput) || !(event.target instanceof Element)) {
        return;
      }
      const tile = event.target.closest<HTMLElement>('.board-space-selectable[data_space_id]');
      const id = tile?.getAttribute('data_space_id') as SpaceId | null | undefined;
      if (tile && id && this.spaces.has(id)) {
        this.onTileSelected(tile);
      }
    },
    onTileSelected(tile: HTMLElement) {
      this.selectedTile = tile;
      this.disableAnimation();
      this.animateSpace(tile, true);
      tile.classList.remove('board-space--available');
      const hideTileConfirmation = getPreferences().hide_tile_confirmation;
      if (hideTileConfirmation) {
        this.confirmPlacement();
      } else {
        this.typedRefs.confirmation.show();
      }
    },
    async saveData() {
      if (this.spaceId === undefined) {
        this.warning = 'Must select a space';
        return;
      }
      const result = await this.onsave({type: 'space', spaceId: this.spaceId});
      if (result === false) {
        this.spaceId = undefined;
        this.selectedTile = undefined;
        this.disableAnimation();
        this.animateSpaces(this.getSelectableSpaces());
      }
    },
  },
  mounted() {
    this.disableAnimation();
    this.animateSpaces(this.getSelectableSpaces());
    document.addEventListener('click', this.onBoardClick);
  },
  beforeUnmount() {
    this.disableAnimation();
    document.removeEventListener('click', this.onBoardClick);
  },
});

</script>
