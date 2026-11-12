import {flushPromises, shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {vi} from 'vitest';
import Card from '@/client/components/card/Card.vue';
import PlayedCardHistory from '@/client/components/logpanel/PlayedCardHistory.vue';
import {CardName} from '@/common/cards/CardName';
import {PlayedCardLogModel} from '@/common/models/PlayedCardLogModel';
import {globalConfig} from '../getLocalVue';
import {fakeViewModel} from '../testHelpers';

describe('PlayedCardHistory', () => {
  it('preserves the reader’s scroll position and highlights only newly received plays', async () => {
    let history: Array<PlayedCardLogModel> = [
      {key: '2', card: CardName.MINING_AREA, player: 'blue'},
      {key: '1', card: CardName.BIRDS, player: 'blue'},
    ];
    vi.stubGlobal('fetch', async () => ({ok: true, json: async () => history}));
    const model = fakeViewModel();
    const wrapper = shallowMount(PlayedCardHistory, {...globalConfig, props: {viewModel: model}});
    try {
      await flushPromises();
      const list = wrapper.get('ol').element;
      Object.defineProperty(list, 'scrollHeight', {get: () => list.children.length * 40});
      list.scrollTop = 60;
      expect(wrapper.findAll('.played-card-history__entry--new')).has.length(0);

      history = [{key: '3', card: CardName.FISH, player: 'red'}, ...history];
      await wrapper.setProps({viewModel: {...model, game: {...model.game, gameAge: 1}}});
      await flushPromises();
      expect(list.scrollTop).eq(100);
      expect(wrapper.get('.played-card-history__entry--new').text()).contains(CardName.FISH);
      expect(wrapper.findAll('.played-card-history__entry')).has.length(3);

      await wrapper.get('.played-card-history__entry--new').trigger('focus');
      expect(wrapper.getComponent(Card).props('card').name).eq(CardName.FISH);

      await wrapper.setProps({viewModel: {...model, game: {...model.game, gameAge: 2}}});
      await flushPromises();
      expect(list.scrollTop).eq(100);
      expect(wrapper.findAll('.played-card-history__entry')).has.length(3);
    } finally {
      wrapper.unmount();
      vi.unstubAllGlobals();
    }
  });
});
