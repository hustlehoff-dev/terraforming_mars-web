import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import MissionHand from '@/client/components/board/MissionHand.vue';
import Card from '@/client/components/card/Card.vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {Tag} from '@/common/cards/Tag';
import {globalConfig} from './getLocalVue';

describe('MissionHand', () => {
  it('uses the same card model in the miniature and preview and opens the actions panel', async () => {
    const card: CardModel = {name: CardName.ANTS, calculatedCost: 4, cloneTag: Tag.MICROBE};
    const wrapper = shallowMount(MissionHand, {...globalConfig, props: {cards: [card]}});

    expect(wrapper.get('.mission-hand__title').text()).contains('4');
    expect(wrapper.get('.mission-hand__thumbnail').getComponent(Card).props('card')).deep.eq(card);
    await wrapper.get('.mission-hand__card').trigger('click');
    expect(wrapper.get('.mission-hand__preview').getComponent(Card).props('card')).deep.eq(card);
    await wrapper.get('.mission-hand__preview a').trigger('click');
    expect(wrapper.emitted('openActions')).has.length(1);
    expect(wrapper.find('.mission-hand__preview').exists()).is.false;
    wrapper.unmount();
  });
});
