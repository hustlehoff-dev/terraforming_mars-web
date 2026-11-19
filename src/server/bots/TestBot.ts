import {Phase} from '../../common/Phase';
import {GameId} from '../../common/Types';
import {IGame} from '../IGame';
import {IGameLoader} from '../database/IGameLoader';
import {UndoTurn} from '../undo/UndoTurn';
import {TestBotDecision} from './TestBotDecision';

/** A slow, bounded server-side driver for ordinary multiplayer seats. */
export class TestBot {
  private static readonly running = new Set<GameId>();
  private static readonly timers = new Map<GameId, ReturnType<typeof setTimeout>>();
  private static readonly blocked = new WeakMap<IGame, Set<string>>();

  /** Player polling also wakes bots after loading a save or restarting the server. */
  public static wake(game: IGame, loader: IGameLoader): void {
    if (!game.gameOptions.testBotColors?.length || game.paused !== undefined || game.phase === Phase.END ||
      this.running.has(game.id) || this.timers.has(game.id)) return;
    if (!game.players.some((player) => {
      const input = player.getWaitingFor();
      return game.gameOptions.testBotColors?.includes(player.color) &&
        ((input !== undefined && !input.optional && !this.blocked.get(game)?.has(`${player.id}:${player.requestId}`)) || game.undoTurnRequest !== undefined);
    })) return;
    const timer = setTimeout(() => {
      this.timers.delete(game.id);
      void this.step(game.id, loader).catch((error) => console.warn('Test bot failed', error));
    }, 900);
    timer.unref();
    this.timers.set(game.id, timer);
  }

  private static async step(id: GameId, loader: IGameLoader): Promise<void> {
    if (this.running.has(id)) return;
    this.running.add(id);
    let game: IGame | undefined;
    let progressed = false;
    try {
      game = await loader.getGame(id);
      if (!game || game.paused !== undefined || game.phase === Phase.END) return;
      const colors = game.gameOptions.testBotColors ?? [];
      const request = UndoTurn.current(game);
      if (request) {
        for (const player of game.players.filter((player) => colors.includes(player.color) && !request.votes.has(player.color))) {
          await UndoTurn.vote(game, player, true);
        }
        return;
      }
      for (const player of game.players) {
        if (!colors.includes(player.color)) continue;
        const input = player.getWaitingFor();
        const key = `${player.id}:${player.requestId}`;
        if (!input || input.optional || this.blocked.get(game)?.has(key)) continue;
        try {
          const response = TestBotDecision.choose(input, player);
          if (!response) throw new Error(`Unsupported decision: ${input.type}`);
          game.markSeen(player);
          player.process(response);
          await loader.saveGame(game);
          await loader.waitForSaves?.(game.id);
          progressed = true;
        } catch (error) {
          console.warn(`Test bot ${player.name} needs manual input`, error);
          const blocked = this.blocked.get(game) ?? new Set<string>();
          blocked.add(`${player.id}:${player.requestId}`);
          this.blocked.set(game, blocked);
          game.log('${0} needs a manual decision. Open this player\'s view to continue.', (builder) => builder.player(player).forNotice());
          await loader.saveGame(game);
        }
        // One input per tick leaves time for animations and other players' requests.
        break;
      }
    } finally {
      this.running.delete(id);
      if (progressed && game) this.wake(game, loader);
    }
  }
}
