import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import PlayerHome from '@/client/components/PlayerHome.vue';
import CardSortButtons from '@/client/components/CardSortButtons.vue';
import SortableCards from '@/client/components/SortableCards.vue';
import {fakeGameModel, fakeGameOptionsModel, fakePlayerViewModel, fakePublicPlayerModel} from './testHelpers';
import {useFakeLocalStorage} from './FakeLocalStorage';
import {CardName} from '@/common/cards/CardName';
import raw_settings from '@/genfiles/settings.json';
import {BoardName} from '@/common/boards/BoardName';
import {getGlobalParameterMaximums} from '@/common/boards/GlobalParameterMaximums';
import {DEFAULT_EXPANSIONS} from '@/common/cards/GameModule';
import {Phase} from '@/common/Phase';
import RivalPanel from '@/client/components/overview/RivalPanel.vue';

describe('PlayerHome', () => {
  useFakeLocalStorage();

  it('indicates whose turn it is only while a player is taking an individual turn', async () => {
    const thisPlayer = fakePublicPlayerModel({color: 'red', isActive: true, tableau: [{name: CardName.ECOLINE}]});
    const rival = fakePublicPlayerModel({color: 'green', isActive: false});
    const game = fakeGameModel({phase: Phase.ACTION, passedPlayers: []});
    const playerView = fakePlayerViewModel({thisPlayer, players: [thisPlayer, rival], game});
    const wrapper = shallowMount(PlayerHome, {...globalConfig, props: {playerView}});
    expect(wrapper.get('.mission-status__your-turn').text()).to.equal('Your turn');

    const nextSelf = {...thisPlayer, isActive: false};
    const nextRival = {...rival, isActive: true};
    const nextView = {...playerView, thisPlayer: nextSelf, players: [nextSelf, nextRival]};
    await wrapper.setProps({playerView: nextView});
    expect(wrapper.find('.mission-status__your-turn').exists()).to.be.false;
    expect(wrapper.getComponent(RivalPanel).props('activeColor')).to.equal('green');

    await wrapper.setProps({playerView: {...nextView, game: {...game, phase: Phase.RESEARCH}}});
    expect(wrapper.getComponent(RivalPanel).props('activeColor')).to.be.undefined;
    wrapper.unmount();
  });

  it('reports the chosen map limits and required extension tracks', async () => {
    const boardName = BoardName.AMAZONIS_PLANITIA;
    const max = getGlobalParameterMaximums(boardName);
    const game = fakeGameModel({
      gameOptions: fakeGameOptionsModel({
        boardName,
        expansions: {...DEFAULT_EXPANSIONS, venus: true, moon: true},
        requiresMoonTrackCompletion: true,
      }),
      temperature: max.temperature,
      oceans: max.oceans - 1,
      moon: {spaces: [], habitatRate: 8, miningRate: 5, logisticRate: 2},
    });
    const wrapper = shallowMount(PlayerHome, {
      ...globalConfig,
      props: {playerView: fakePlayerViewModel({game})},
    });
    const temperature = wrapper.get('.mission-status__metric--temperature');
    expect(temperature.text()).to.include(`${max.temperature}°C`);
    expect(temperature.find('.mission-status__check').exists()).to.be.true;
    expect(wrapper.get('.mission-status__metric--oceans').text()).to.include(`/ ${max.oceans}`);
    expect(wrapper.get('.mission-status__metric--venus').text()).to.include(`/ ${max.venus}%`);
    expect(wrapper.get('.mission-status__metric--mining').text()).to.include('5/ 8');
    expect(wrapper.find('.mission-status__complete').exists()).to.be.false;

    await wrapper.setProps({playerView: fakePlayerViewModel({game: {...game, isTerraformed: true}})});
    expect(wrapper.get('.mission-status__complete').text()).to.eq('Terraforming complete');
  });

  it('mounts without errors', () => {
    const wrapper = shallowMount(PlayerHome, {
      ...globalConfig,
      parentComponent: {
        methods: {
          getVisibilityState: () => true,
          setVisibilityState: () => {},
        },
      },
      props: {
        playerView: fakePlayerViewModel(),
        settings: raw_settings,
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  it('sort buttons sort the hand', async () => {
    // The hand only renders once the player has a tableau.
    const thisPlayer = fakePublicPlayerModel({tableau: [{name: CardName.ECOLINE}]});
    const playerView = fakePlayerViewModel({thisPlayer, players: [thisPlayer], cardsInHand: [{name: CardName.ANTS}]});
    const wrapper = shallowMount(PlayerHome, {
      ...globalConfig,
      parentComponent: {
        methods: {
          getVisibilityState: () => true,
          setVisibilityState: () => {},
        },
      },
      props: {
        playerView,
        settings: raw_settings,
      },
    });

    wrapper.findComponent(CardSortButtons).vm.$emit('update:sortOrder', {key: 'vp', reversed: false});
    await wrapper.vm.$nextTick();

    expect(wrapper.findComponent(SortableCards).props('sortOrder')).to.deep.eq({key: 'vp', reversed: false});
  });
});
