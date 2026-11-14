import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {RouteError} from './RouteError';
import {Server} from '../models/ServerModel';

/**
 * Pauses or resumes a game. Any player of the game can do it: ?id=<playerId>&paused=true|false.
 */
export class ApiPause extends Handler {
  public static readonly INSTANCE = new ApiPause();

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
    if (ctx.urlParams.stringOrUndefined('paused') === 'true') {
      game.pause(player);
    } else {
      game.resume(player);
    }
    await ctx.gameLoader.waitForSaves?.(game.id);
    responses.writeJson(res, ctx, Server.getPlayerModel(player));
  }
}
