import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {nextTick, shallowRef} from 'vue';
import AtlasBoard from '@/client/components/board/AtlasBoard.vue';
import Board from '@/client/components/Board.vue';
import {mapPlacementKey} from '@/client/components/board/MapPlacement';
import {SpaceBonus} from '@/common/boards/SpaceBonus';
import {SpaceType} from '@/common/boards/SpaceType';
import {SelectSpaceModel} from '@/common/models/PlayerInputModel';
import {fakeGameModel} from './testHelpers';
import {globalConfig} from './getLocalVue';

describe('AtlasBoard', () => {
  it('shows the inspected sector and updates its placement prompt when the active choice changes', async () => {
    const input = shallowRef<SelectSpaceModel>();
    const wrapper = shallowMount(AtlasBoard, {
      global: {...globalConfig.global, provide: {[mapPlacementKey]: {input}}},
      props: {
        game: fakeGameModel({spaces: [{id: '04', a9: 'A2', spaceType: SpaceType.OCEAN, bonus: [SpaceBonus.STEEL, SpaceBonus.STEEL]}]}),
        tileView: 'show',
      },
    });

    wrapper.findComponent(Board).vm.$emit('inspectSpace', '04');
    input.value = {type: 'space', title: 'Select space for ocean tile', buttonLabel: 'Confirm', spaces: ['04']};
    await nextTick();

    expect(wrapper.find('.atlas-inspector__sector').text()).to.include('A2');
    expect(wrapper.find('.atlas-inspector__bonuses').text()).to.include('+2 Steel');
    expect(wrapper.find('.atlas-inspector__action--ready').text()).to.include('Select space for ocean tile');

    input.value = undefined;
    await nextTick();

    expect(wrapper.find('.atlas-inspector__action').exists()).to.be.false;
  });
});
