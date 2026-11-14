/**
 * True when several server instances share one database (hosts that scale out, e.g. Vercel
 * containers). Then games are checked against the database on every request, answers wait for
 * saves, and stale saves are refused. On a single server these cost round trips for nothing.
 */
export const multiInstance = process.env.MULTI_INSTANCE === '1' || process.env.VERCEL !== undefined;
