import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import MissionHand from '@/client/components/board/MissionHand.vue';
import Card from '@/client/components/card/Card.vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {Tag} from '@/common/cards/Tag';
import {globalConfig} from './getLocalVue';

describe('MissionHand', () => {
  const card: CardModel = {name: CardName.ANTS, calculatedCost: 4, cloneTag: Tag.MICROBE};

  // jsdom has no PointerEvent, so build pointer events from mouse events.
  async function pointer(element: Element, type: string, clientX: number, clientY: number) {
    const event = new MouseEvent(type, {button: 0, clientX, clientY, bubbles: true});
    Object.defineProperty(event, 'pointerId', {value: 1});
    element.dispatchEvent(event);
    await Promise.resolve();
  }

  function mountHand(playable = true) {
    return shallowMount(MissionHand, {
      ...globalConfig,
      attachTo: document.body,
      props: {cards: [card], playableCards: new Set(playable ? [card.name] : [])},
    });
  }

  it('raises the same card on hover instead of rendering a second copy', async () => {
    const wrapper = mountHand();
    const original = wrapper.getComponent(Card);
    const hit = wrapper.get('button');
    expect(original.props('card')).deep.eq(card);
    expect(original.props('art')).is.true;
    expect(hit.attributes('aria-label')).eq('Ants · Playable now');
    await hit.trigger('pointerenter', {pointerType: 'mouse'});
    expect(wrapper.get('.mission-hand__face--raised').getComponent(Card).element).eq(original.element);
    await hit.trigger('pointerleave');
    expect(wrapper.find('.mission-hand__face--raised').exists()).is.false;
    wrapper.unmount();
  });

  it('asks to hold the card over the board on click', async () => {
    const wrapper = mountHand();
    await wrapper.get('button').trigger('click');
    const preview = wrapper.emitted('preview');
    expect(preview).has.length(1);
    expect((preview![0] as Array<unknown>)[0]).deep.eq(card);
    wrapper.unmount();
  });

  it('plays a playable card dragged up out of the hand', async () => {
    const wrapper = mountHand();
    const hit = wrapper.get('button');
    hit.element.setPointerCapture = () => {};
    hit.element.getBoundingClientRect = () => new DOMRect(30, 280, 90, 140);
    await pointer(hit.element, 'pointerdown', 50, 300);
    await pointer(hit.element, 'pointermove', 52, 100);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.mission-hand__face--armed').exists()).is.true;
    await pointer(hit.element, 'pointerup', 52, 100);
    expect(wrapper.emitted('play')).has.length(1);
    // The click that follows a drag does not also lift the card.
    await hit.trigger('click');
    expect(wrapper.emitted('preview')).is.undefined;
    wrapper.unmount();
  });

  it('does not play a card that cannot be played', async () => {
    const wrapper = mountHand(false);
    const hit = wrapper.get('button');
    hit.element.setPointerCapture = () => {};
    hit.element.getBoundingClientRect = () => new DOMRect(30, 280, 90, 140);
    await pointer(hit.element, 'pointerdown', 50, 300);
    await pointer(hit.element, 'pointermove', 52, 100);
    await pointer(hit.element, 'pointerup', 52, 100);
    expect(wrapper.emitted('play')).is.undefined;
    wrapper.unmount();
  });
});
