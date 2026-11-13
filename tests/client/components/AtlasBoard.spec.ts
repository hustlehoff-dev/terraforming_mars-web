import {mount, shallowMount} from '@vue/test-utils';
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
      global: {...globalConfig.global, provide: {[mapPlacementKey]: {input}}, stubs: {Teleport: true, MarsSurface: false}},
      props: {
        game: fakeGameModel({spaces: [{id: '04', a9: 'A2', spaceType: SpaceType.OCEAN, bonus: [SpaceBonus.STEEL, SpaceBonus.STEEL]}]}),
        tileView: 'show',
      },
    });

    const anchor = document.createElement('div');
    wrapper.findComponent(Board).vm.$emit('inspectSpace', '04', anchor);
    input.value = {type: 'space', title: 'Select space for ocean tile', buttonLabel: 'Confirm', spaces: ['04']};
    await nextTick();

    expect(wrapper.find('.atlas-tooltip__sector').text()).to.include('A2');
    expect(wrapper.find('.atlas-tooltip__bonuses').text()).to.include('+2 Steel');
    expect(wrapper.find('.atlas-inspector__action--ready').text()).to.include('Select space for ocean tile');

    input.value = undefined;
    await nextTick();

    expect(wrapper.find('.atlas-inspector__action').exists()).to.be.false;
    wrapper.unmount();
  });

  it('anchors the tooltip to the inspected sector and clears it on pointer leave', async () => {
    const wrapper = mount(AtlasBoard, {
      global: {...globalConfig.global, stubs: {Teleport: true}},
      props: {
        game: fakeGameModel({spaces: [{id: '04', a9: 'A2', spaceType: SpaceType.OCEAN, bonus: []}]}),
        tileView: 'show',
      },
    });

    const sector = wrapper.get<HTMLElement>('[data_space_id="04"]');
    sector.element.getBoundingClientRect = () => new DOMRect(window.innerWidth - 46, 50, 40, 44);
    await sector.trigger('pointerover');
    await nextTick();

    const tooltip = wrapper.get<HTMLElement>('[role="tooltip"]');
    expect(tooltip.text()).to.include('Ocean reserve');
    expect(Number.parseFloat(tooltip.element.style.left)).to.be.lessThan(sector.element.getBoundingClientRect().left);
    expect(sector.attributes('aria-describedby')).to.equal(tooltip.attributes('id'));

    await sector.trigger('pointerout');
    expect(wrapper.find('[role="tooltip"]').exists()).to.be.false;

    await sector.trigger('focusin');
    await nextTick();
    expect(wrapper.find('[role="tooltip"]').exists()).to.be.true;
    await sector.trigger('focusout');
    expect(wrapper.find('[role="tooltip"]').exists()).to.be.false;

    let selected = false;
    sector.element.onclick = () => {
      selected = true;
    };
    await sector.trigger('click');
    expect(selected).to.be.true;
    expect(wrapper.find('[role="tooltip"]').exists()).to.be.true;
    wrapper.unmount();
  });
});
