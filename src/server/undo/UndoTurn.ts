import {Color} from '../../common/Color';
import {Phase, UNDO_TURN_PHASES} from '../../common/Phase';
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {Game} from '../Game';
import {Database} from '../database/Database';
import {GameLoader} from '../database/GameLoader';
import {SerializedGame} from '../SerializedGame';

/**
 * Undoing a turn with every player's consent.
 *
 * A player asks to undo the last turn; every other player agrees (or one refuses, which cancels
 * it). The game then goes back to the save made when that turn started. The game is saved at the
 * start of each turn, so those saves are where a turn can go back to. The undone state is saved
 * as a new, newest save: nothing is deleted from the history.
 */
export type UndoTurnRequest = {
  /** Who asked. */
  by: Color;
  /** The player whose turn goes back to its start, and in which generation. */
  turnOf: Color;
  generation: number;
  /** The save to go back to. */
  saveId: number;
  /** Players who agreed (the one who asked included). */
  votes: Set<Color>;
  /** The game as it was when asked: anything played meanwhile cancels the request. */
  gameAge: number;
  undoCount: number;
};

export type UndoTurnStatus = {
  request?: {by: Color, turnOf: Color, generation: number, votes: Array<Color>, waitingFor: Array<Color>},
};

const CONTROL_MESSAGES = new Set([
  '${0} paused the game',
  '${0} resumed the game',
  'Every player agreed: the turn of ${0} was undone',
]);

/** Pause/resume and undo notices do not mean another game action was taken. */
function gameplayAge(state: Pick<SerializedGame, 'gameAge' | 'gameLog'>): number {
  let age = state.gameAge;
  for (let index = state.gameLog.length - 1; index >= 0; index--) {
    const message = state.gameLog[index]?.message;
    if (message === undefined || !CONTROL_MESSAGES.has(message)) {
      break;
    }
    age--;
  }
  return Math.max(0, age);
}

export class UndoTurn {
  private constructor() {}

  /** A request that still matches the game (nothing was played since it was made). */
  public static current(game: IGame): UndoTurnRequest | undefined {
    const request = game.undoTurnRequest;
    if (request !== undefined && (request.gameAge !== game.gameAge || request.undoCount !== game.undoCount || !UNDO_TURN_PHASES.includes(game.phase))) {
      game.undoTurnRequest = undefined;
      return undefined;
    }
    return request;
  }

  public static status(game: IGame): UndoTurnStatus {
    const request = UndoTurn.current(game);
    if (request === undefined) {
      return {};
    }
    return {request: {
      by: request.by,
      turnOf: request.turnOf,
      generation: request.generation,
      votes: game.players.filter((player) => request.votes.has(player.color)).map((player) => player.color),
      waitingFor: game.players.filter((player) => !request.votes.has(player.color)).map((player) => player.color),
    }};
  }

  /**
   * The save made when the last turn started: the newest turn start (action phase, nothing done
   * yet by the player whose turn it is) older than the game as it is now.
   */
  private static async *turnStarts(game: IGame): AsyncGenerator<{saveId: number, serialized: SerializedGame}> {
    const db = Database.getInstance();
    const saveIds = (await db.getSaveIds(game.id)).filter((id) => id < game.lastSaveId).sort((a, b) => b - a);
    const age = gameplayAge(game);
    for (const saveId of saveIds) {
      let serialized: SerializedGame;
      try {
        serialized = await db.getGameVersion(game.id, saveId);
      } catch {
        continue;
      }
      if (serialized.phase !== Phase.ACTION || gameplayAge(serialized) >= age) {
        continue;
      }
      const active = serialized.players.find((player) => player.id === serialized.activePlayer);
      // takeAction saves before checking a pass. Such a transition snapshot advances the
      // generation again when deserialized, so it cannot be an undo checkpoint.
      if (active !== undefined && active.actionsTakenThisRound === 0 && !serialized.passedPlayers.includes(active.id)) {
        yield {saveId, serialized};
      }
    }
  }

  public static async findTurnStart(game: IGame): Promise<{saveId: number, serialized: SerializedGame} | undefined> {
    for await (const start of UndoTurn.turnStarts(game)) {
      return start;
    }
    return undefined;
  }

  /** Read-only checkpoint metadata; only requested explicitly, never by the regular status poll. */
  public static async preview(game: IGame): Promise<{target: {saveId: number, generation: number} | null, generations: Array<number>}> {
    let target: {saveId: number, generation: number} | null = null;
    const generations = new Set<number>();
    for await (const start of UndoTurn.turnStarts(game)) {
      target ??= {saveId: start.saveId, generation: start.serialized.generation};
      generations.add(start.serialized.generation);
    }
    return {target, generations: [...generations].sort((a, b) => b - a)};
  }

  /** A player asks to undo the last turn. With nobody else to ask, it happens at once. */
  public static async request(game: IGame, player: IPlayer): Promise<void> {
    if (!UNDO_TURN_PHASES.includes(game.phase)) {
      throw new Error('The turn cannot be undone');
    }
    if (UndoTurn.current(game) !== undefined) {
      return;
    }
    const start = await UndoTurn.findTurnStart(game);
    if (start === undefined) {
      throw new Error('There is no turn to undo');
    }
    const turnOf = start.serialized.players.find((candidate) => candidate.id === start.serialized.activePlayer)?.color ?? player.color;
    game.undoTurnRequest = {
      by: player.color,
      turnOf,
      generation: start.serialized.generation,
      saveId: start.saveId,
      votes: new Set([player.color]),
      gameAge: game.gameAge,
      undoCount: game.undoCount,
    };
    await UndoTurn.maybeUndo(game);
  }

  /** Another player agrees (or refuses: the request is dropped). */
  public static async vote(game: IGame, player: IPlayer, agree: boolean): Promise<void> {
    const request = UndoTurn.current(game);
    if (request === undefined) {
      throw new Error('Nobody asked to undo a turn');
    }
    if (!agree) {
      game.undoTurnRequest = undefined;
      return;
    }
    request.votes.add(player.color);
    await UndoTurn.maybeUndo(game);
  }

  /** The one who asked takes the request back. */
  public static cancel(game: IGame, player: IPlayer): void {
    if (UndoTurn.current(game)?.by === player.color) {
      game.undoTurnRequest = undefined;
    }
  }

  private static async maybeUndo(game: IGame): Promise<void> {
    const request = game.undoTurnRequest;
    if (request === undefined || game.players.some((player) => !request.votes.has(player.color))) {
      return;
    }
    game.undoTurnRequest = undefined;
    const serialized = await Database.getInstance().getGameVersion(game.id, request.saveId);
    // The game this one replaces stops its turn clocks.
    game.players.forEach((player) => player.stopTurnLimit());
    // Deserialization rebuilds the active input and may save immediately. Install current
    // control state and the new history position before that can happen.
    const restored = Game.deserialize({
      ...serialized,
      paused: game.paused,
      lastSaveId: game.lastSaveId,
      undoCount: game.undoCount + 1,
    });
    const turnOf = restored.players.find((candidate) => candidate.color === request.turnOf);
    if (turnOf !== undefined) {
      restored.log('Every player agreed: the turn of ${0} was undone', (b) => b.player(turnOf).forNotice());
    }
    const loader = GameLoader.getInstance();
    await loader.add(restored);
    await loader.saveGame(restored);
  }
}
