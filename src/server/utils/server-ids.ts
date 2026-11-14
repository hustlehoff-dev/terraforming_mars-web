import * as fs from 'fs';

export function generateRandomId(prefix: string): string {
  // 281474976710656 possible values.
  return prefix + Math.floor(Math.random() * Math.pow(16, 12)).toString(16);
}

export const serverId = process.env.SERVER_ID || generateRandomId('');
export const statsId = process.env.STATS_ID || generateRandomId('');
// The same for every instance of one deployment (hosts that scale out, or wake a sleeping
// container), so open pages are not told that the server restarted. A random ID otherwise.
/** The time this server file was built: identical in every container made from one image. */
function buildStamp(): string | undefined {
  try {
    return Math.floor(fs.statSync(__filename).mtimeMs).toString(16);
  } catch {
    return undefined;
  }
}

const deploymentId = process.env.RUN_ID || process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || buildStamp();
export const runId = deploymentId ? 'r' + deploymentId : generateRandomId('r');
