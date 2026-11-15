/**
 * True when several server instances can share one database at the same time. Then games are
 * checked against the database on every request, answers wait for saves, and stale saves are
 * refused. On a single server these cost round trips for nothing.
 *
 * - Vercel scales out to several containers.
 * - Render (env RENDER) deploys without downtime: the new instance starts serving while the old
 *   one still runs, so for a while both hold the game in memory. Without the checks a choice made
 *   on one instance (e.g. cards bought) is overwritten by a save from the other one, and the
 *   player has to choose again.
 * - MULTI_INSTANCE=1 turns it on anywhere else.
 */
export const multiInstance = process.env.MULTI_INSTANCE === '1' || process.env.VERCEL !== undefined || process.env.RENDER !== undefined;
