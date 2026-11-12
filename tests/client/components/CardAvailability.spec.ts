import {expect} from 'chai';
import {getCardAvailability} from '@/client/utils/CardAvailability';
import {CardName} from '@/common/cards/CardName';
import {OrOptionsModel, SelectCardModel, SelectProjectCardToPlayModel} from '@/common/models/PlayerInputModel';
import {Phase} from '@/common/Phase';
import {fakeGameModel, fakePlayerViewModel, fakePublicPlayerModel} from './testHelpers';

describe('CardAvailability', () => {
  it('highlights only legal projects and unused actions in the active turn', () => {
    const thisPlayer = fakePublicPlayerModel({color: 'red', isActive: true});
    const projects: SelectProjectCardToPlayModel = {
      type: 'projectCard',
      title: 'Play project card',
      buttonLabel: 'Play card',
      cards: [{name: CardName.ANTS, isDisabled: true}, {name: CardName.BIRDS}],
      paymentOptions: {},
      microbes: 0,
      floaters: 0,
      lunaArchivesScience: 0,
      seeds: 0,
      graphene: 0,
      kuiperAsteroids: 0,
      auroraiData: 0,
      spireScience: 0,
    };
    const actions: SelectCardModel = {
      type: 'card',
      title: 'Take an action from a blue card',
      buttonLabel: 'Take action',
      cards: [{name: CardName.INVENTORS_GUILD}],
      min: 1,
      max: 1,
      selectBlueCardAction: true,
      showOnlyInLearnerMode: false,
      showOwner: false,
      showSelectAll: false,
    };
    const waitingFor: OrOptionsModel = {
      type: 'or',
      title: 'Take action',
      buttonLabel: 'Confirm',
      options: [projects, actions],
    };
    const view = fakePlayerViewModel({
      color: 'red',
      thisPlayer,
      waitingFor,
      game: fakeGameModel({phase: Phase.ACTION, passedPlayers: []}),
    });

    expect([...getCardAvailability(view).projects]).to.deep.equal([CardName.BIRDS]);
    expect([...getCardAvailability(view).actions]).to.deep.equal([CardName.INVENTORS_GUILD]);
    const afterUsingAction = {...view, waitingFor: {...waitingFor, options: [projects]}};
    expect(getCardAvailability(afterUsingAction).actions.size).to.equal(0);
    const rivalTurn = {...view, thisPlayer: {...thisPlayer, isActive: false}};
    expect(getCardAvailability(rivalTurn).projects.size).to.equal(0);
    expect(getCardAvailability(rivalTurn).actions.size).to.equal(0);
  });
});
