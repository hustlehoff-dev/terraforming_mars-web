import {expect} from 'chai';
import {Game} from '../../src/server/Game';
import {TestPlayer} from '../TestPlayer';
import {Phase} from '../../src/common/Phase';
import {UndoTurn} from '../../src/server/undo/UndoTurn';
import {GameLoader} from '../../src/server/database/GameLoader';
import {InMemoryDatabase} from '../testing/InMemoryDatabase';
import {restoreTestDatabase, setTestDatabase} from '../testing/setup';
import {GameId} from '../../src/common/Types';

describe('Undoing a turn with every player agreeing', () => {
  let gameNumber = 0;

  async function startTurn() {
    const db = new InMemoryDatabase();
    setTestDatabase(db);
    const player = new TestPlayer('blue');
    const player2 = new TestPlayer('red');
    gameNumber++;
    const game = Game.newInstance(`g-undo-${gameNumber}` as GameId, [player, player2], player, 'spectatorid');
    game.players.forEach((p) => (p as TestPlayer).popWaitingFor());
    await GameLoader.getInstance().add(game);
    game.phase = Phase.ACTION;
    // The start of the turn is saved.
    player.takeAction();
    // Then something happens in that turn.
    const ageAtStart = game.gameAge;
    player.megaCredits = 99;
    game.log('${0} did something', (b) => b.player(player));
    return {game, player, player2, ageAtStart};
  }

  afterEach(() => restoreTestDatabase());

  it('goes back to the start of the turn once every player agrees', async () => {
    const {game, player, player2, ageAtStart} = await startTurn();

    await UndoTurn.request(game, player);
    expect(UndoTurn.status(game).request).deep.include({by: 'blue', turnOf: 'blue', votes: ['blue'], waitingFor: ['red']});

    await UndoTurn.vote(game, player2, true);
    const restored = await GameLoader.getInstance().getGame(game.id);
    expect(restored).not.eq(game);
    expect(restored?.undoCount).eq(game.undoCount + 1);
    expect(restored?.getPlayerById(player.id).megaCredits).not.eq(99);
    // The undone state is the newest save; the history is kept.
    expect(restored?.lastSaveId).greaterThan(game.lastSaveId);
    expect(restored?.gameAge).greaterThanOrEqual(ageAtStart);
  });

  it('is dropped when a player refuses', async () => {
    const {game, player, player2} = await startTurn();
    await UndoTurn.request(game, player);
    await UndoTurn.vote(game, player2, false);
    expect(UndoTurn.status(game).request).is.undefined;
    expect(await GameLoader.getInstance().getGame(game.id)).eq(game);
  });

  it('is dropped when something is played meanwhile', async () => {
    const {game, player} = await startTurn();
    await UndoTurn.request(game, player);
    game.log('${0} did something else', (b) => b.player(player));
    expect(UndoTurn.status(game).request).is.undefined;
  });
});
