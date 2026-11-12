import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import MissionHand from '@/client/components/board/MissionHand.vue';
import Card from '@/client/components/card/Card.vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {Tag} from '@/common/cards/Tag';
import {globalConfig} from './getLocalVue';

describe('MissionHand', () => {
  it('raises and lowers the same card instead of rendering a second copy', async () => {
    const card: CardModel = {name: CardName.ANTS, calculatedCost: 4, cloneTag: Tag.MICROBE};
    const wrapper = shallowMount(MissionHand, {
      ...globalConfig,
      props: {cards: [card], playableCards: new Set([card.name])},
    });
    const original = wrapper.getComponent(Card);
    const hit = wrapper.get('button');
    expect(original.props('card')).deep.eq(card);
    expect(hit.attributes('aria-label')).eq('Ants · Playable now');
    await hit.trigger('pointerenter', {pointerType: 'mouse'});
    expect(wrapper.get('.mission-hand__face--raised').getComponent(Card).element).eq(original.element);
    await hit.trigger('pointerleave');
    expect(hit.attributes('aria-expanded')).eq('false');

    await hit.trigger('click');
    expect(hit.attributes('aria-expanded')).eq('true');
    expect(wrapper.findAllComponents(Card)).has.length(1);
    expect(wrapper.getComponent(Card).element).eq(original.element);
    await hit.trigger('keydown', {key: 'Escape'});
    expect(hit.attributes('aria-expanded')).eq('false');
    wrapper.unmount();
  });
});
