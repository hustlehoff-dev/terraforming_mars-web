import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import SelectSpace from '@/client/components/SelectSpace.vue';
import {useFakeLocalStorage} from './FakeLocalStorage';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {shallowRef} from 'vue';
import {SelectSpaceModel} from '@/common/models/PlayerInputModel';
import {mapPlacementKey} from '@/client/components/board/MapPlacement';

describe('SelectSpace', () => {
  useFakeLocalStorage();

  it('mounts without errors', () => {
    const wrapper = shallowMount(SelectSpace, {
      ...globalConfig,
      props: {
        playerView: {} as PlayerViewModel,
        playerinput: {
          title: 'Select a space',
          buttonLabel: 'Save',
          type: 'space',
          spaces: [],
        },
        onsave: () => {},
        showsave: true,
        showtitle: true,
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  it('clears board highlights and click handlers on unmount', () => {
    const input = shallowRef<SelectSpaceModel>();
    const board = document.createElement('div');
    board.id = 'main_board';
    const tile = document.createElement('div');
    tile.classList.add('board-space-selectable');
    tile.setAttribute('data_space_id', '03');
    board.appendChild(tile);
    document.body.appendChild(board);

    const wrapper = shallowMount(SelectSpace, {
      global: {...globalConfig.global, provide: {[mapPlacementKey]: {input}}},
      props: {
        playerView: {} as PlayerViewModel,
        playerinput: {
          title: 'Select a space',
          buttonLabel: 'Save',
          type: 'space',
          spaces: ['03'],
        },
        onsave: () => {},
        showsave: true,
        showtitle: true,
      },
    });

    expect(tile.classList.contains('board-space--available')).is.true;
    expect(tile.onclick).is.not.null;
    expect(input.value?.spaces).to.deep.eq(['03']);

    wrapper.unmount();

    expect(tile.classList.contains('board-space--available')).is.false;
    expect(tile.onclick).is.null;
    expect(input.value).is.undefined;

    board.remove();
  });
});
