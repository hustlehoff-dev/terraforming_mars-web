import * as fs from 'fs';
import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';

let buildId: string | undefined;

/** The build of the client this server serves (written by webpack to build/build-id.txt). */
function readBuildId(): string {
  if (buildId === undefined) {
    try {
      buildId = fs.readFileSync('build/build-id.txt', 'utf8').trim();
    } catch {
      buildId = '';
    }
  }
  return buildId;
}

/**
 * Answers {build} with the id of the client build this server serves. A page still running an
 * older build (opened before a deploy) sees the difference and reloads itself.
 */
export class ApiBuild extends Handler {
  public static readonly INSTANCE = new ApiBuild();

  public override get(_req: Request, res: Response, ctx: Context): Promise<void> {
    responses.writeJson(res, ctx, {build: readBuildId()});
    return Promise.resolve();
  }
}
