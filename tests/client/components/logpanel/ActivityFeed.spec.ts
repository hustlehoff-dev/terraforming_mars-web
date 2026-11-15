import {flushPromises, shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {vi} from 'vitest';
import {closeCardZoom, zoomedCard} from '@/client/components/board/cardZoom';
import ActivityFeed from '@/client/components/logpanel/ActivityFeed.vue';
import {CardName} from '@/common/cards/CardName';
import {GameActivityModel} from '@/common/models/GameActivityModel';
import {globalConfig} from '../getLocalVue';
import {fakeViewModel} from '../testHelpers';

describe('ActivityFeed', () => {
  it('keeps the latest entry at the bottom, keeps the reader’s place and shows new cards and board actions together', async () => {
    let history: Array<GameActivityModel> = [
      {key: '2', kind: 'played', card: CardName.MINING_AREA, player: 'blue'},
      {key: '1', kind: 'placed', subject: 'ocean tile', space: '05', player: 'red'},
    ];
    vi.stubGlobal('fetch', async () => ({ok: true, json: async () => history}));
    const model = fakeViewModel();
    const wrapper = shallowMount(ActivityFeed, {...globalConfig, props: {viewModel: model}});
    try {
      const list = wrapper.get('ol').element;
      Object.defineProperty(list, 'scrollHeight', {get: () => list.children.length * 40});
      await flushPromises();
      // Oldest first, the latest at the bottom, scrolled down to it.
      expect(wrapper.findAll('.activity-feed__entry').map((entry) => entry.attributes('aria-label'))).deep.eq(['red placed ocean tile', 'blue played Mining Area']);
      expect(list.scrollTop).eq(80);
      expect(wrapper.findAll('.activity-feed__entry--new')).has.length(0);
      await wrapper.get('[aria-label*="placed ocean tile"]').trigger('click');
      expect(wrapper.emitted('spaceClicked')).deep.eq([['05']]);

      // At the latest entry: a new one comes in at the bottom and the list follows it.
      history = [{key: '3', kind: 'played', card: CardName.FISH, player: 'red'}, ...history];
      await wrapper.setProps({viewModel: {...model, game: {...model.game, gameAge: 1}}});
      await flushPromises();
      expect(list.scrollTop).eq(120);
      expect(wrapper.get('.activity-feed__entry--new').text()).contains('played ' + CardName.FISH);
      expect(wrapper.findAll('.activity-feed__entry')).has.length(3);

      // A click shows the played card up close in the middle of the screen.
      await wrapper.get('.activity-feed__entry--new').trigger('click');
      expect(zoomedCard.value?.name).eq(CardName.FISH);
      closeCardZoom();

      // Reading older entries: the place is kept, and the button goes back to the latest.
      list.scrollTop = 10;
      await wrapper.get('ol').trigger('scroll');
      await wrapper.setProps({viewModel: {...model, game: {...model.game, gameAge: 2}}});
      await flushPromises();
      expect(list.scrollTop).eq(10);
      await wrapper.get('.activity-feed__header button').trigger('click');
      expect(list.scrollTop).eq(120);
    } finally {
      wrapper.unmount();
      vi.unstubAllGlobals();
    }
  });

  it('opens the card window for cards revealed or discarded only for the player who did it', async () => {
    let history: Array<GameActivityModel> = [];
    vi.stubGlobal('fetch', async () => ({ok: true, json: async () => history}));
    const model = fakeViewModel();
    const wrapper = shallowMount(ActivityFeed, {...globalConfig, props: {viewModel: model}});
    try {
      await flushPromises();
      // Another player (red) uses Search for Life: this player (blue) gets no window.
      history = [{key: 'a', kind: 'action', card: CardName.SEARCH_FOR_LIFE, player: 'red', deck: [{kind: 'discarded', cards: [CardName.FISH]}]}];
      await wrapper.setProps({viewModel: {...model, game: {...model.game, gameAge: 1}}});
      await flushPromises();
      expect(wrapper.findComponent({name: 'ActivityCardReveal'}).exists()).is.false;
      // This player uses it: the window shows the discarded card.
      history = [{key: 'b', kind: 'action', card: CardName.SEARCH_FOR_LIFE, player: 'blue', deck: [{kind: 'discarded', cards: [CardName.BIRDS]}]}, ...history];
      await wrapper.setProps({viewModel: {...model, game: {...model.game, gameAge: 2}}});
      await flushPromises();
      expect(wrapper.findComponent({name: 'ActivityCardReveal'}).exists()).is.true;
    } finally {
      wrapper.unmount();
      vi.unstubAllGlobals();
    }
  });

  it('opens no card window after buying cards: they were in the buying window', async () => {
    let history: Array<GameActivityModel> = [];
    vi.stubGlobal('fetch', async () => ({ok: true, json: async () => history}));
    const model = fakeViewModel();
    const wrapper = shallowMount(ActivityFeed, {...globalConfig, props: {viewModel: model}});
    try {
      await flushPromises();
      history = [{key: 'buy', kind: 'bought', player: 'blue', subject: '1 card(s)', buying: {bought: 1, discarded: 1},
        deck: [{kind: 'bought', cards: [CardName.FISH]}, {kind: 'discarded', cards: [CardName.BIRDS]}]}];
      await wrapper.setProps({viewModel: {...model, game: {...model.game, gameAge: 1}}});
      await flushPromises();
      expect(wrapper.findComponent({name: 'ActivityCardReveal'}).exists()).is.false;
    } finally {
      wrapper.unmount();
      vi.unstubAllGlobals();
    }
  });

  it('updates the Comet row when a legacy server sends the ocean as a separate entry', async () => {
    let history: Array<GameActivityModel> = [{key: 'play', kind: 'played', card: CardName.COMET, player: 'blue', effects: '+3:r:heat:'}];
    vi.stubGlobal('fetch', async () => ({ok: true, json: async () => history}));
    const model = fakeViewModel();
    const wrapper = shallowMount(ActivityFeed, {...globalConfig, props: {viewModel: model}});
    try {
      await flushPromises();
      const comet = wrapper.get('.activity-feed__entry').element;
      history = [{key: 'ocean', kind: 'placed', subject: 'ocean tile', space: '45', player: 'blue', effects: '+1:r:plants:'}, ...history];
      await wrapper.setProps({viewModel: {...model, game: {...model.game, gameAge: 1}}});
      await flushPromises();

      expect(wrapper.findAll('.activity-feed__entry')).has.length(1);
      const row = wrapper.get('.activity-feed__entry');
      expect(row.element).eq(comet);
      expect(row.text()).contains('Comet');
      expect(row.text()).contains('Placed ocean tile on sector 45');
      expect(row.get('.activity-feed__units').text()).contains('+1');

      history = [{key: 'action:2:blue', kind: 'placed', subject: 'greenery tile', space: '16', player: 'blue'}, ...history];
      await wrapper.setProps({viewModel: {...model, game: {...model.game, gameAge: 2}}});
      await flushPromises();
      expect(wrapper.findAll('.activity-feed__entry')).has.length(2);
    } finally {
      wrapper.unmount();
      vi.unstubAllGlobals();
    }
  });
});
