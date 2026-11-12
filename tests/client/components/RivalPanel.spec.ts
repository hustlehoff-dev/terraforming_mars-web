import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import Card from '@/client/components/card/Card.vue';
import RivalPanel from '@/client/components/overview/RivalPanel.vue';
import {globalConfig} from './getLocalVue';
import {fakePublicPlayerModel} from './testHelpers';

describe('RivalPanel', () => {
  const ownPlayer = fakePublicPlayerModel({color: 'red', name: 'Me'});

  it('hides solo play and shows only four rival summaries with live resource counts', async () => {
    const firstRival = fakePublicPlayerModel({color: 'green', name: 'Rival', megacredits: 23, steel: 2, titanium: 3, plants: 4, energy: 5, heat: 6});
    const extraRivals = [
      fakePublicPlayerModel({color: 'yellow'}),
      fakePublicPlayerModel({color: 'blue'}),
      fakePublicPlayerModel({color: 'black'}),
      fakePublicPlayerModel({color: 'purple', name: 'Fifth rival'}),
    ];
    const wrapper = mount(RivalPanel, {
      ...globalConfig,
      props: {players: [ownPlayer], playerColor: 'red'},
    });

    expect(wrapper.find('aside').exists()).to.be.false;
    await wrapper.setProps({players: [ownPlayer, firstRival, ...extraRivals]});

    const tiles = wrapper.findAll('aside > ul .rival-tile');
    expect(tiles).to.have.length(4);
    expect(tiles[0].find('.rival-tile__name').text()).to.equal('Rival');
    expect(tiles[0].findAll('.rival-tile__resource').map((resource) => resource.text())).to.deep.equal(['23', '2', '3', '4', '5', '6']);
    expect(wrapper.get('.rival-panel__more').text()).to.equal('+1');
    await wrapper.setProps({players: [ownPlayer, {...firstRival, megacredits: 31}, ...extraRivals]});
    expect(wrapper.get('.rival-tile__resource').text()).to.equal('31');

    await wrapper.setProps({activeColor: 'green'});
    expect(wrapper.get('.rival-tile--active').get('.rival-tile__status').text()).to.equal('Now playing');
    await wrapper.setProps({activeColor: 'purple'});
    expect(wrapper.find('aside > ul .rival-tile--active').exists()).to.be.false;
    expect(wrapper.get('.rival-panel__overflow-turn').text()).to.contain('Fifth rival');
    expect(wrapper.get('.rival-panel__overflow-turn').get('.rival-tile__status').text()).to.equal('Now playing');

    await wrapper.setProps({activeColor: 'red'});
    expect(wrapper.find('.rival-panel__overflow-turn').exists()).to.be.false;
    expect(wrapper.find('.rival-tile--active').exists()).to.be.false;
    wrapper.unmount();
  });

  it('opens public played cards and provides an empty state for a rival outside the first four', async () => {
    const wrapper = mount(RivalPanel, {
      attachTo: document.body,
      global: {...globalConfig.global, stubs: {Card: true}},
      props: {
        playerColor: 'red',
        players: [
          ownPlayer,
          fakePublicPlayerModel({color: 'green', tableau: [{name: CardName.ANTS}], selfReplicatingRobotsCards: [{name: CardName.ECOLINE}]}),
          fakePublicPlayerModel({color: 'yellow'}),
          fakePublicPlayerModel({color: 'blue'}),
          fakePublicPlayerModel({color: 'black'}),
          fakePublicPlayerModel({color: 'purple', name: 'Extra rival', tableau: []}),
        ],
      },
    });

    await wrapper.get('.rival-tile').trigger('click');
    const dialog = wrapper.get<HTMLDialogElement>('dialog');
    expect(dialog.element.open).to.be.true;
    expect(wrapper.findAllComponents(Card).map((card) => card.props('card').name)).to.deep.equal([CardName.ANTS]);

    dialog.element.close();
    await wrapper.get('.rival-panel__more').trigger('click');
    expect(dialog.element.open).to.be.true;
    expect(dialog.get('.rival-tile__name').text()).to.equal('Extra rival');

    await dialog.get('.rival-tile').trigger('click');
    expect(dialog.get('.rival-panel__empty').text()).to.equal('No played cards yet.');
    dialog.element.close();
    wrapper.unmount();
  });
});
