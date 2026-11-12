import {flushPromises, shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {vi} from 'vitest';
import Card from '@/client/components/card/Card.vue';
import ActivityFeed from '@/client/components/logpanel/ActivityFeed.vue';
import {CardName} from '@/common/cards/CardName';
import {GameActivityModel} from '@/common/models/GameActivityModel';
import {globalConfig} from '../getLocalVue';
import {fakeViewModel} from '../testHelpers';

describe('ActivityFeed', () => {
  it('preserves the reader’s scroll position and shows new cards and board actions together', async () => {
    let history: Array<GameActivityModel> = [
      {key: '2', kind: 'played', card: CardName.MINING_AREA, player: 'blue'},
      {key: '1', kind: 'placed', subject: 'ocean tile', space: '05', player: 'blue'},
    ];
    vi.stubGlobal('fetch', async () => ({ok: true, json: async () => history}));
    const model = fakeViewModel();
    const wrapper = shallowMount(ActivityFeed, {...globalConfig, props: {viewModel: model}});
    try {
      await flushPromises();
      const list = wrapper.get('ol').element;
      Object.defineProperty(list, 'scrollHeight', {get: () => list.children.length * 40});
      list.scrollTop = 60;
      expect(wrapper.findAll('.activity-feed__entry--new')).has.length(0);
      await wrapper.get('[title*="placed ocean tile"]').trigger('click');
      expect(wrapper.emitted('spaceClicked')).deep.eq([['05']]);

      history = [{key: '3', kind: 'played', card: CardName.FISH, player: 'red'}, ...history];
      await wrapper.setProps({viewModel: {...model, game: {...model.game, gameAge: 1}}});
      await flushPromises();
      expect(list.scrollTop).eq(100);
      expect(wrapper.get('.activity-feed__entry--new').text()).contains('played ' + CardName.FISH);
      expect(wrapper.findAll('.activity-feed__entry')).has.length(3);

      await wrapper.get('.activity-feed__entry--new').trigger('click');
      expect(wrapper.getComponent(Card).props('card').name).eq(CardName.FISH);

      await wrapper.setProps({viewModel: {...model, game: {...model.game, gameAge: 2}}});
      await flushPromises();
      expect(list.scrollTop).eq(100);
      expect(wrapper.findAll('.activity-feed__entry')).has.length(3);
      await wrapper.get('.activity-feed__header button').trigger('click');
      expect(list.scrollTop).eq(0);
    } finally {
      wrapper.unmount();
      vi.unstubAllGlobals();
    }
  });
});
