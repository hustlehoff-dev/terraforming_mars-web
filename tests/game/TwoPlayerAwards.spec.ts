import {expect} from 'chai';
import {Banker} from '../../src/server/awards/Banker';
import {Resource} from '../../src/common/Resource';
import {testGame} from '../TestingUtils';

describe('Awards in a 2-player game', () => {
  it('gives 5 VP for 1st place and 2 VP for 2nd place', () => {
    const [game, player, player2] = testGame(2);
    game.fundAward(player, new Banker());
    player.production.add(Resource.MEGACREDITS, 6);
    player2.production.add(Resource.MEGACREDITS, 5);

    expect(player.getVictoryPoints().awards).to.eq(5);
    expect(player2.getVictoryPoints().awards).to.eq(2);
  });

  it('gives 5 VP to both players on a tie for 1st place', () => {
    const [game, player, player2] = testGame(2);
    game.fundAward(player, new Banker());
    player.production.add(Resource.MEGACREDITS, 5);
    player2.production.add(Resource.MEGACREDITS, 5);

    expect(player.getVictoryPoints().awards).to.eq(5);
    expect(player2.getVictoryPoints().awards).to.eq(5);
  });
});
