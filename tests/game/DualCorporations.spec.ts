import {expect} from 'chai';
import {testGame} from '../TestGame';
import {cast} from '../../src/common/utils/utils';
import {SelectInitialCards} from '../../src/server/inputs/SelectInitialCards';
import {TerralabsResearch} from '../../src/server/cards/turmoil/TerralabsResearch';
import {Polyphemos} from '../../src/server/cards/colonies/Polyphemos';
import {PowerPlant} from '../../src/server/cards/base/PowerPlant';
import {CardName} from '../../src/common/cards/CardName';

describe('Two corporations', () => {
  it('deals twice the corporations', () => {
    const [, player] = testGame(2, {skipInitialCardSelection: false, dualCorporations: true});
    expect(player.dealtCorporationCards).has.length(4);
  });

  it('plays both, with half of their M€ and the cheaper card price', () => {
    const [, player] = testGame(1, {skipInitialCardSelection: false, dualCorporations: true});
    const polyphemos = new Polyphemos();
    const terralabs = new TerralabsResearch();
    const select = cast(player.getWaitingFor(), SelectInitialCards);
    select.options[0].cb([polyphemos, terralabs]);
    select.options[1].cb([new PowerPlant(), new PowerPlant()]);
    select.cb(undefined);

    expect(player.tableau.has(CardName.POLYPHEMOS)).is.true;
    expect(player.tableau.has(CardName.TERRALABS_RESEARCH)).is.true;
    // (50 + 14) / 2 = 32, minus 2 cards at Terralabs' price of 1.
    expect(player.megaCredits).eq(30);
    expect(player.cardCost).eq(1);
  });

  it('is refused with one corporation', () => {
    const [, player] = testGame(1, {skipInitialCardSelection: false, dualCorporations: true});
    const select = cast(player.getWaitingFor(), SelectInitialCards);
    expect(() => select.options[0].cb([new Polyphemos()])).to.throw();
  });
});
