import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {RouteError} from './RouteError';
import {Server} from '../models/ServerModel';

/**
 * Ends a game before Mars is terraformed: ?id=<playerId>&kind=surrender|ended.
 * Any player can surrender (and is placed last); only the creator of the game can end it with
 * the score as it stands.
 */
export class ApiEndGame extends Handler {
  public static readonly INSTANCE = new ApiEndGame();

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
    const kind = ctx.urlParams.stringOrUndefined('kind');
    if (kind !== 'surrender' && kind !== 'ended') {
      throw RouteError.badRequest('kind must be surrender or ended');
    }
    if (kind === 'ended' && !game.isCreator(player)) {
      throw RouteError.badRequest('Only the creator of the game can end it');
    }
    await game.endEarly(player, kind);
    await ctx.gameLoader.waitForSaves?.(game.id);
    responses.writeJson(res, ctx, Server.getPlayerModel(player));
  }
}
