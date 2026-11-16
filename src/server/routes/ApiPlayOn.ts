import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {RouteError} from './RouteError';
import {Server} from '../models/ServerModel';

/**
 * On the end screen, a player agrees to play on until the map is full: ?id=<playerId>.
 * When every player has agreed, the game goes on with the next generation.
 */
export class ApiPlayOn extends Handler {
  public static readonly INSTANCE = new ApiPlayOn();

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
    if (!game.canPlayOn()) {
      throw RouteError.badRequest('The game cannot go on');
    }
    await game.votePlayOn(player);
    await ctx.gameLoader.waitForSaves?.(game.id);
    responses.writeJson(res, ctx, Server.getPlayerModel(player));
  }
}
