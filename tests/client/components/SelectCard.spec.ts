import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import SelectCard from '@/client/components/SelectCard.vue';
import {fakePlayerViewModel} from './testHelpers';
import {CardName} from '@/common/cards/CardName';
import {Phase} from '@/common/Phase';
import {it as vitestIt, vi} from 'vitest';

describe('SelectCard', () => {
  vitestIt.each([1, 2])('submits the draft automatically after %i selected cards', async (count) => {
    const onsave = vi.fn();
    const model = fakePlayerViewModel();
    const cards = [{name: CardName.MINING_AREA}, {name: CardName.BIRDS}];
    const wrapper = shallowMount(SelectCard, {
      ...globalConfig,
      props: {
        playerView: {...model, game: {...model.game, phase: Phase.DRAFTING}, thisPlayer: {...model.thisPlayer, needsToDraft: true}},
        playerinput: {title: 'Select', buttonLabel: 'Select', type: 'card', cards, min: count, max: count,
          showOnlyInLearnerMode: false, selectBlueCardAction: false, showOwner: false, showSelectAll: false, dealtFromDeck: true},
        onsave,
        showsave: true,
      },
    });
    expect(wrapper.find('app-button-stub').exists()).to.be.false;
    const inputs = wrapper.findAll('input');
    for (const input of inputs.slice(0, count)) {
      expect(onsave.mock.calls).to.have.length(0);
      await input.setValue(true);
    }
    expect(onsave.mock.calls).to.deep.equal([[{type: 'card', cards: cards.slice(0, count).map((card) => card.name)}]]);
    wrapper.unmount();
  });

  it('mounts without errors', () => {
    const wrapper = shallowMount(SelectCard, {
      ...globalConfig,
      props: {
        playerView: fakePlayerViewModel(),
        playerinput: {
          title: 'Select a card',
          buttonLabel: 'Save',
          type: 'card',
          cards: [],
          max: 1,
          min: 1,
          showOnlyInLearnerMode: false,
          selectBlueCardAction: false,
          showOwner: false,
          showSelectAll: false,
        },
        onsave: () => {},
        showsave: true,
        showtitle: true,
      },
    });
    expect(wrapper.exists()).to.be.true;
  });
});
