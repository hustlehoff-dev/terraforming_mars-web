import {expect} from 'chai';
import {testGame} from '../TestingUtils';
import {Game} from '../../src/server/Game';
import {Server} from '../../src/server/models/ServerModel';

describe('Who opened their game link', () => {
  it('shows in the game room only the players who opened their link', () => {
    const [game, player] = testGame(2);
    game.markSeen(player);
    const players = Server.getSimpleGameModel(game).players;
    expect(players.find((p) => p.id === player.id)?.seenAgoMs).is.a('number');
    expect(players.filter((p) => p.seenAgoMs === undefined)).has.length(1);
  });

  it('is kept when the game is saved and loaded', () => {
    const [game, player] = testGame(2);
    game.markSeen(player);
    const loaded = Game.deserialize(game.serialize());
    expect(loaded.lastSeen.get(player.id)).eq(game.lastSeen.get(player.id));
  });
});

describe('Who has the game open now', () => {
  it('is greyed again a while after the page was closed', () => {
    const [game, player, player2] = testGame(2);
    game.markSeen(player);
    expect(game.isOnline(player)).is.true;
    expect(game.isOnline(player2)).is.false;
    game.lastSeen.set(player.id, Date.now() - Game.ONLINE_MS - 1);
    expect(game.isOnline(player)).is.false;
    expect(Server.getPlayerModel(player).players.map((p) => p.online)).deep.eq([false, false]);
  });
});
