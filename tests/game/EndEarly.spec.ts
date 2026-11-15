import {expect} from 'chai';
import {testGame} from '../TestingUtils';
import {Phase} from '../../src/common/Phase';

describe('Ending a game early', () => {
  it('a player surrenders: the game ends, marked as their surrender', async () => {
    const [game, player, player2] = testGame(2);
    game.phase = Phase.ACTION;
    await game.endEarly(player2, 'surrender');

    expect(game.phase).to.eq(Phase.END);
    expect(game.endedEarly).deep.eq({by: player2.color, kind: 'surrender'});
    expect(player.getWaitingFor()).is.undefined;
    expect(player2.getWaitingFor()).is.undefined;
  });

  it('only the creator (first player of the form) can end it with the score', async () => {
    const [game, creator, other] = testGame(2);
    game.phase = Phase.ACTION;
    expect(game.isCreator(creator)).is.true;
    expect(game.isCreator(other)).is.false;

    let failed = false;
    try {
      await game.endEarly(other, 'ended');
    } catch {
      failed = true;
    }
    expect(failed).is.true;
    expect(game.phase).to.eq(Phase.ACTION);

    await game.endEarly(creator, 'ended');
    expect(game.phase).to.eq(Phase.END);
    expect(game.endedEarly).deep.eq({by: creator.color, kind: 'ended'});
  });

  it('keeps the way it ended after loading the game', async () => {
    const [game, , player2] = testGame(2);
    game.phase = Phase.ACTION;
    await game.endEarly(player2, 'surrender');
    const serialized = game.serialize();
    expect(serialized.endedEarly).deep.eq({by: player2.color, kind: 'surrender'});
  });
});
