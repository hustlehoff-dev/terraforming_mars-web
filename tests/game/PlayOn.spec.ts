import {expect} from 'chai';
import {testGame} from '../TestingUtils';
import {Phase} from '../../src/common/Phase';
import {TileType} from '../../src/common/TileType';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {Game} from '../../src/server/Game';

describe('Playing on until the map is full', () => {
  it('starts only when every player agrees, then goes on with the next generation', async () => {
    const [game, player, player2] = testGame(2);
    game.phase = Phase.END;
    const generation = game.generation;
    expect(game.canPlayOn()).is.true;

    await game.votePlayOn(player);
    expect(game.phase).eq(Phase.END);
    expect(game.playOn).is.false;
    expect(Array.from(game.playOnVotes)).deep.eq([player.id]);

    await game.votePlayOn(player2);
    expect(game.playOn).is.true;
    expect(game.phase).not.eq(Phase.END);
    expect(game.generation).eq(generation + 1);
    expect(game.playOnVotes.size).eq(0);
  });

  it('then the game is over only once the map is full', () => {
    const [game, player] = testGame(2);
    game.playOn = true;
    expect(game.gameIsOver()).is.false;
    for (const space of game.board.spaces) {
      if (space.spaceType === SpaceType.LAND && space.tile === undefined) {
        space.tile = {tileType: TileType.GREENERY};
        space.player = player;
      }
    }
    expect(game.mapIsFull()).is.true;
    expect(game.gameIsOver()).is.true;
  });

  it('is not offered after a game ended early', async () => {
    const [game, player] = testGame(2);
    game.phase = Phase.ACTION;
    await game.endEarly(player, 'ended');
    expect(game.canPlayOn()).is.false;
  });

  it('keeps the votes and the phase when saved and loaded', () => {
    const [game, player] = testGame(2);
    game.playOn = true;
    game.playOnVotes.add(player.id);
    const loaded = Game.deserialize(game.serialize());
    expect(loaded.playOn).is.true;
    expect(Array.from(loaded.playOnVotes)).deep.eq([player.id]);
  });
});
