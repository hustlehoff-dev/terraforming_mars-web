import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {RouteError} from './RouteError';
import {Server} from '../models/ServerModel';
import {Game} from '../Game';

/**
 * Takes back the action whose space the player is choosing (e.g. a card that places a city):
 * the game goes back to the state before it, with everything that was paid returned.
 * ?id=<playerId>. Only offered while nothing hidden came out (see PlayerInput).
 */
export class ApiCancelPlacement extends Handler {
  public static readonly INSTANCE = new ApiCancelPlacement();

  public override async get(_req: Request, res: Response, ctx: Context): Promise<void> {
    const playerId = ctx.urlParams.playerId('id');
    ctx.ipTracker.addParticipant(playerId, ctx.ip);
    const game = await ctx.gameLoader.getGame(playerId);
    if (game === undefined) {
      throw RouteError.notFound('cannot find game for that player');
    }
    let player;
    try {
      player = game.getPlayerById(playerId);
    } catch {
      throw RouteError.notFound('player not found');
    }
    const undo = game.placementUndo;
    if (undo === undefined || !game.canCancelPlacement(player)) {
      // Nothing to take back (any more): answer with the current state.
      responses.writeJson(res, ctx, Server.getPlayerModel(player));
      return;
    }
    game.placementUndo = undefined;
    game.stopClocks();
    const restored = Game.deserialize(undo.snapshot);
    // Saves keep counting up; pages of the other players see the change and refresh.
    restored.lastSaveId = game.lastSaveId;
    restored.undoCount = game.undoCount + 1;
    await ctx.gameLoader.add(restored);
    restored.save();
    await ctx.gameLoader.waitForSaves?.(restored.id);
    responses.writeJson(res, ctx, Server.getPlayerModel(restored.getPlayerById(playerId)));
  }
}
