import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import MissionCardStage from '@/client/components/board/MissionCardStage.vue';
import Card from '@/client/components/card/Card.vue';
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {globalConfig} from './getLocalVue';
import {useFakeLocalStorage} from './FakeLocalStorage';

describe('MissionCardStage', () => {
  useFakeLocalStorage();

  function mountStage() {
    return mount(MissionCardStage, {
      ...globalConfig,
      attachTo: document.body,
      global: {...globalConfig.global, stubs: {SelectProjectCardToPlay: true}},
      props: {card: {name: CardName.ANTS}, input: undefined, playerView: {} as PlayerViewModel},
    });
  }

  it('holds the card over the board without a dialog', () => {
    const wrapper = mountStage();
    const stage = document.body.querySelector('.mission-stage');
    expect(stage).is.not.null;
    expect(document.body.querySelector('dialog')).is.null;
    expect(stage!.classList.contains('mission-stage--skin-classic')).is.true;
    expect(wrapper.getComponent(Card).props('art')).is.true;
    expect(stage!.textContent).contains('You cannot play this card now');
    wrapper.unmount();
  });

  it('puts the card back on Escape and on a click outside', async () => {
    const wrapper = mountStage();
    const stage = document.body.querySelector<HTMLElement>('.mission-stage')!;
    stage.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    expect(wrapper.emitted('close')).has.length(1);
    document.body.dispatchEvent(new Event('pointerdown', {bubbles: true}));
    expect(wrapper.emitted('close')).has.length(2);
    wrapper.unmount();
  });
});
