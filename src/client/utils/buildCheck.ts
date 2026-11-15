import {paths} from '@/common/app/paths';

declare const __CLIENT_BUILD__: string | undefined;

/** This page's client build (set by webpack); undefined in tests and tools. */
const clientBuild = typeof __CLIENT_BUILD__ === 'string' ? __CLIENT_BUILD__ : undefined;

const CHECK_EVERY_MS = 60_000;

/**
 * After a deploy, open pages keep running the old code (they are not reloaded when the server
 * restarts). This asks the server which build it serves, every minute and when the page comes
 * back into view, and reloads the page once it differs. Choices in progress are remembered
 * (choiceMemory), and the game state is on the server.
 */
export function startBuildCheck(): void {
  if (clientBuild === undefined) {
    return;
  }
  let reloading = false;
  const check = async () => {
    if (reloading || document.visibilityState === 'hidden') {
      return;
    }
    try {
      const response = await fetch(paths.API_BUILD, {cache: 'no-store'});
      if (!response.ok) {
        return;
      }
      const {build} = await response.json() as {build?: string};
      if (build && build !== clientBuild) {
        reloading = true;
        window.location.reload();
      }
    } catch {
      // Offline or restarting: try again later.
    }
  };
  window.setInterval(check, CHECK_EVERY_MS);
  document.addEventListener('visibilitychange', () => void check());
}
