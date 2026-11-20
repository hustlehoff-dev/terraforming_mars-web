import {expect} from 'chai';
import {testGame} from '../TestGame';
import {cast} from '../../src/common/utils/utils';
import {StormCraftIncorporated} from '../../src/server/cards/colonies/StormCraftIncorporated';
import {TestBotDecision} from '../../src/server/bots/TestBotDecision';
import {SelectInitialCards} from '../../src/server/inputs/SelectInitialCards';
import {InputResponse} from '../../src/common/inputs/InputResponse';

describe('TestBotDecision', () => {
  it('pays heat with heat and Stormcraft floaters', () => {
    const [, player] = testGame(2);
    const card = new StormCraftIncorporated();
    player.playedCards.push(card);
    card.resourceCount = 3;
    player.heat = 7;
    const input = card.spendHeat(player, 8);
    const response = TestBotDecision.choose(input, player) as InputResponse;
    expect(response).deep.eq({type: 'and', responses: [{type: 'amount', amount: 6}, {type: 'amount', amount: 1}]});
    input.process(response, player);
    expect(player.heat).eq(1);
    expect(card.resourceCount).eq(2);
  });

  it('picks 2 corporations in the two corporations mode', () => {
    const [, player] = testGame(2, {skipInitialCardSelection: false, dualCorporations: true});
    const input = cast(player.getWaitingFor(), SelectInitialCards);
    const response = TestBotDecision.choose(input, player) as InputResponse;
    expect(response.type).eq('initialCards');
    if (response.type === 'initialCards') {
      const corps = response.responses[0];
      expect(corps.type === 'card' ? corps.cards : []).has.length(2);
    }
    player.process(response);
    expect(player.pickedSecondCorporationCard).is.not.undefined;
  });
});
