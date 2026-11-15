import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import MissionEffectsBar from '@/client/components/board/MissionEffectsBar.vue';
import {CardName} from '@/common/cards/CardName';

describe('MissionEffectsBar', () => {
  it('a click on a card opens the window; only its button uses the action', async () => {
    const tableau = [{name: CardName.POINT_LUNA}, {name: CardName.SEARCH_FOR_LIFE}];
    const wrapper = mount(MissionEffectsBar, {
      ...globalConfig,
      props: {tableau, lit: new Set<CardName>(), usable: new Set([CardName.SEARCH_FOR_LIFE])},
    });
    const thumbnails = wrapper.findAll('.mission-effects__card');
    expect(thumbnails).has.length(2);
    await thumbnails[1].trigger('click');
    // The thumbnail never fires the action by itself.
    expect(wrapper.emitted('use')).is.undefined;
    // The window lists the cards, the clicked one first, with a button for the usable one.
    const cards = wrapper.findAll('.mission-effects-window__card');
    expect(cards).has.length(2);
    expect(cards[0].classes()).contains('mission-effects-window__card--focused');
    const use = wrapper.findAll('.mission-effects-window__use');
    expect(use).has.length(1);
    await use[0].trigger('click');
    expect(wrapper.emitted('use')?.[0]?.[0]).deep.eq({name: CardName.SEARCH_FOR_LIFE});
    // The title opens the same window, not all played cards.
    await wrapper.get('.mission-effects__title').trigger('click');
    expect(wrapper.emitted('openAll')).is.undefined;
  });
});
