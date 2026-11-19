<template>
  <div>
    <template v-if="showWaitingStatus && (waitingfor === undefined || waitingfor.optional)">
      <template v-if="waitingfor === undefined">
        {{ $t('Not your turn to take any actions') }}
      </template>
      <template v-else>
        <span v-if="!centerDeckChoice || !draftRepick" role="status">
          {{ $t('Waiting for other players') }}<template v-if="draftRepick && draftPlayers.length"> · {{ draftPlayers.join(', ') }}</template>
        </span>
      </template>
      <template v-if="playersWaitingFor.length > 0 && !draftRepick">
        (⌛ <span v-for="color in playersWaitingFor" class="log-player" :class="playerColorClass(color, 'bg')" :key="color">{{ getPlayerName(color) }}</span>)
      </template>
    </template>
    <Teleport v-if="waitingfor !== undefined && !hideInput && (!draftRepick || showLockedDraft)" to="body" :disabled="!showDeckDialog">
      <component :is="showDeckDialog ? 'dialog' : 'div'" ref="inputContainer" class="wf-root"
        :class="{'deck-choice-dialog': showDeckDialog}" :aria-label="showDeckDialog ? $t(waitingfor.title) : undefined" @cancel.prevent>
        <PlayerInputFactory :players="playerView.players"
          :playerView="playerView"
          :playerinput="waitingfor"
          :onsave="onsave"
          :showsave="!draftRepick"
          :showtitle="true"
          :key="inputKey" />
        <DialogPeek v-if="showDeckDialog && (!cardsAllGiven || preludeChoice)" />
      </component>
    </Teleport>
  </div>
</template>

<script lang="ts">
/* global RequestInit */

import {computed, defineComponent} from 'vue';
import {isDraftRepick, showsCards} from '@/client/components/board/MissionQuickAction';
import DialogPeek from '@/client/components/common/DialogPeek.vue';
import * as constants from '@/common/constants';
import raw_settings from '@/genfiles/settings.json';
import {vueRoot} from '@/client/components/vueRoot';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {playerColorClass} from '@/common/utils/utils';
import {PlayerViewModel, ViewModel} from '@/common/models/PlayerModel';
import {getPreferences} from '@/client/utils/PreferencesManager';
import {SoundManager} from '@/client/utils/SoundManager';
import {WaitingForModel} from '@/common/models/WaitingForModel';
import {Phase} from '@/common/Phase';
import {paths} from '@/common/app/paths';
import {statusCode} from '@/common/http/statusCode';
import {isPlayerId} from '@/common/Types';
import {InputResponse} from '@/common/inputs/InputResponse';
import {INVALID_REQUEST_ID, INVALID_RUN_ID, AppErrorResponse} from '@/common/app/AppErrorId';
import {Color} from '@/common/Color';
import {gameDocumentTitle} from '../utils/documentTitle';
import {revealOpen} from '@/client/components/logpanel/revealState';
import {reuseGameView} from '@/client/utils/reuseGameView';
import {setFaviconStatus, setFaviconTurnFrame} from '@/client/utils/favicon';

let ui_update_timeout_id: number | undefined;
let otherPlayersTimer: number | undefined;
let documentTitleTimer: number | undefined;
let deadlineTimer: number | undefined;
let animationFrame = 0;

// How often to refresh other players' status during simultaneous phases.
const OTHER_PLAYERS_INTERVAL = 3000;
// The same while a time limit may start, so the clock shows at once.
const FAST_PLAYERS_INTERVAL = 1000;
// Phases where every player makes a choice at the same time.
const SIMULTANEOUS_PHASES: ReadonlyArray<Phase> = [Phase.INITIALDRAFTING, Phase.DRAFTING, Phase.RESEARCH];

// The spinning ◑◒◐◓ symbol used to indicate it's your turn.
const TURN_SEQUENCE = '◑◒◐◓';

// On a desktop browser the favicon is visible in the tab, so we spin it there
// rather than cluttering the document title. Mobile browsers don't show tab
// favicons, so they keep animating the title instead.
function isDesktopBrowser(): boolean {
  return !/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

type DataModel = {
  playersWaitingFor: Array<Color>,
  /** Changes with every new player view, so the input starts fresh. */
  inputKey: number,
}

const CANNOT_CONTACT_SERVER = 'Unable to reach the server. It may be restarting or down for maintenance.';

export default defineComponent({
  name: 'WaitingFor',
  components: {DialogPeek},
  // Emits 'waitingPlayers' (colours still choosing) while it waits; not declared in `emits`, which
  // would narrow `$emit` and break vueRoot(this).
  // Card inputs inside the card window lay their cards out like a deal from the deck.
  provide() {
    return {cardDialog: computed(() => this.showDeckDialog)};
  },
  props: {
    centerDeckChoice: Boolean,
    hideInput: Boolean,
    showLockedDraft: Boolean,
    showWaitingStatus: {type: Boolean, default: true},
    playerView: {
      type: Object as () => ViewModel,
      required: true,
    },
    waitingfor: {
      type: Object as () => PlayerInputModel | undefined,
      default: undefined,
    },
    requestId: {
      type: String as () => string | undefined,
      default: undefined,
    },
  },
  data(): DataModel {
    return {
      playersWaitingFor: [],
      inputKey: 0,
    };
  },
  watch: {
    showDeckDialog: {flush: 'post', handler: 'openDeckDialog'},
    paused: {flush: 'post', handler: 'openDeckDialog'},
    // While the drawn cards are shown, the choice waits behind them (closed, its state kept).
    revealShowing: {flush: 'post', handler(showing: boolean) {
      const dialog = this.$refs.inputContainer;
      if (showing && dialog instanceof HTMLDialogElement && dialog.open && typeof dialog.close === 'function') {
        dialog.close();
      } else if (!showing) {
        this.openDeckDialog();
      }
    }},
    playerView() {
      this.inputKey++;
      this.stop();
      this.start();
    },
  },
  methods: {
    openDeckDialog() {
      const dialog = this.$refs.inputContainer;
      if (!(dialog instanceof HTMLDialogElement)) {
        return;
      }
      if (this.playerView.game.paused !== undefined) {
        // Keep the choice mounted, but release its modal focus trap so Resume can be reached.
        if (dialog.open) {
          dialog.close();
        }
        return;
      }
      if (this.showDeckDialog && !revealOpen.value && !dialog.open) {
        dialog.showModal();
      }
    },
    start() {
      document.title = gameDocumentTitle(this.playerView.game);
      if (getPreferences().experimental_ui) {
        setFaviconStatus(this.waitingfor !== undefined ? 'turn' : 'idle');
      }
      window.clearInterval(documentTitleTimer);
      if (this.waitingfor === undefined || this.waitingfor.optional) {
        this.waitForUpdate();
      } else if (this.playerView.players.length > 1 && SIMULTANEOUS_PHASES.includes(this.playerView.game.phase)) {
        this.watchOtherPlayers();
      } else if (this.playerView.players.length > 1) {
        this.watchForChanges();
      }
      if (this.playerView.players.length > 1 && this.waitingfor !== undefined && !this.waitingfor.optional) {
        documentTitleTimer = window.setInterval(() => this.animateTitle(), 1000);
      }
      // With a turn time limit the server passes for the player at the deadline; nothing tells
      // this page, so it fetches the new state shortly after the clock reaches zero.
      window.clearTimeout(deadlineTimer);
      const deadline = this.playerView.thisPlayer?.turnDeadline;
      if (deadline !== undefined && this.waitingfor !== undefined) {
        deadlineTimer = window.setTimeout(() => {
          void vueRoot(this).updatePlayer();
        }, Math.max(0, deadline - Date.now()) + 2000);
      }
    },
    stop() {
      window.clearTimeout(ui_update_timeout_id);
      ui_update_timeout_id = undefined;
      window.clearTimeout(otherPlayersTimer);
      otherPlayersTimer = undefined;
      window.clearInterval(documentTitleTimer);
      documentTitleTimer = undefined;
      window.clearTimeout(deadlineTimer);
      deadlineTimer = undefined;
    },
    getPlayerName(color: Color): string {
      const player = this.playerView.players.find((p) => p.color === color);
      return player ? player.name : color;
    },
    animateTitle() {
      if (!getPreferences().animated_title) {
        return;
      }

      animationFrame = (animationFrame + 1) % TURN_SEQUENCE.length;
      const experimental = getPreferences().experimental_ui;
      // The favicon annotation is an experimental feature.
      if (experimental) {
        setFaviconTurnFrame(animationFrame);
      }
      // Existing behavior spins the symbol in the document title. With
      // experimental UI on a desktop browser we show it only in the tab favicon
      // instead; otherwise keep animating the title.
      if (!(experimental && isDesktopBrowser())) {
        document.title = TURN_SEQUENCE[animationFrame] + ' ' + gameDocumentTitle(this.playerView.game);
      }
    },
    onsave(out: InputResponse) {
      return this.fetchPlayerInput(
        paths.PLAYER_INPUT + '?id=' + this.playerView.id,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({runId: this.playerView.runId, requestId: this.requestId, ...out}),
        });
    },
    reset() {
      this.fetchPlayerInput(
        paths.RESET + '?id=' + this.playerView.id,
        {method: 'GET'});
    },
    fetchPlayerInput(url: string, options: RequestInit) {
      const root = vueRoot(this);
      if (root.isServerSideRequestInProgress) {
        console.warn('Server request in progress');
        return Promise.resolve(false);
      }

      root.isServerSideRequestInProgress = true;
      return fetch(url, options)
        .then(async (response) => {
          if (response.ok) {
            this.updatePlayerView(await response.json());
            return true;
          }

          const showAlert = vueRoot(this).showAlert;
          if (response.status === statusCode.badRequest) {
            const resp = await response.json() as AppErrorResponse;
            if (resp.id === INVALID_RUN_ID || resp.id === INVALID_REQUEST_ID) {
              // The page or the game copy was out of date: load the current state quietly.
              window.location.reload();
              return false;
            }
            showAlert('Error with input', resp.message);
          } else {
            showAlert('Error processing response', 'Unexpected response from server. Please try again.');
            console.error(response.statusText);
          }
          return false;
        })
        .catch((e) => {
          root.showAlert('Error sending input,', CANNOT_CONTACT_SERVER);
          console.error(e);
          return false;
        })
        .finally(() => {
          root.isServerSideRequestInProgress = false;
        });
    },
    updatePlayerView(playerView: PlayerViewModel | undefined) {
      const root = vueRoot(this);
      root.playerView = playerView === undefined ? undefined : reuseGameView(root.playerView, playerView);
      root.screen = 'player-home';
      if (playerView?.game.phase === Phase.END && !window.location.search.includes('&noredirect')) {
        root.screen = 'the-end';
        window.history.replaceState(playerView, document.title, `${paths.THE_END}?id=${playerView.id}`);
      }
    },
    /** On this player's turn: every few seconds, ask whether the game changed (e.g. was paused). */
    watchForChanges() {
      clearTimeout(ui_update_timeout_id);
      ui_update_timeout_id = window.setTimeout(async () => {
        try {
          const response = await fetch(paths.API_WAITING_FOR + window.location.search + '&gameAge=' + this.playerView.game.gameAge + '&undoCount=' + this.playerView.game.undoCount);
          const result = response.ok ? await response.json() as WaitingForModel : undefined;
          if (result?.result === 'REFRESH' && await vueRoot(this).updatePlayer()) {
            return;
          }
        } catch {
          // Try again on the next round.
        }
        this.watchForChanges();
      }, 6000);
    },
    waitForUpdate() {
      const vueApp = this;
      const root = vueRoot(this);
      clearTimeout(ui_update_timeout_id);
      const askForUpdate = () => {
        const view = this.playerView;
        const xhr = new XMLHttpRequest();
        xhr.open('GET', paths.API_WAITING_FOR + window.location.search + '&gameAge=' + this.playerView.game.gameAge + '&undoCount=' + this.playerView.game.undoCount);
        xhr.onerror = function() {
          root.showAlert('Error fetching state', CANNOT_CONTACT_SERVER, () => vueApp.waitForUpdate());
        };
        xhr.onload = async () => {
          if (vueApp.playerView !== view) {
            return;
          }
          if (xhr.status === statusCode.ok) {
            const result = xhr.response as WaitingForModel;
            this.playersWaitingFor = result.waitingFor;
            if (result.online !== undefined) {
              // eslint-disable-next-line vue/require-explicit-emits -- see the note above `provide`.
              vueApp.$emit('onlinePlayers', result.online);
            }
            if (result.result === 'WAIT') {
              // eslint-disable-next-line vue/require-explicit-emits -- see the note above `provide`.
              vueApp.$emit('waitingPlayers', result.waitingFor);
            }
            if (result.result === 'GO') {
              // Will only apply to player, not spectator.
              const updated = root.updatePlayer();
              this.notify();
              // When the fetch works, root.playerView changes and the playerView watcher
              // calls start(), which decides whether to keep polling. When it fails
              // nothing changes, so poll again here.
              if (!await updated) {
                vueApp.waitForUpdate();
              }
              // We don't need to wait anymore - it's our turn
              return;
            } else if (result.result === 'REFRESH') {
              // Something changed, let's refresh UI
              if (isPlayerId(this.playerView.id)) {
                if (!await root.updatePlayer()) {
                  vueApp.waitForUpdate();
                }
              } else if (!await root.updateSpectator()) {
                vueApp.waitForUpdate();
              }

              return;
            }
            vueApp.waitForUpdate();
          } else {
            root.showAlert('Error with input', `Received unexpected response from server (${xhr.status}). This is often due to the server restarting.`, () => vueApp.waitForUpdate());
          }
        };
        xhr.responseType = 'json';
        xhr.send();
      };
      ui_update_timeout_id = window.setTimeout(askForUpdate, raw_settings.waitingForTimeout);
    },
    /**
     * While this player makes a simultaneous choice (e.g. drafting), keep the other
     * players' status current without redrawing the choice in progress.
     */
    /** A draft or buying clock may start any moment: another player choosing starts it. */
    clockPossible(): boolean {
      const game = this.playerView.game;
      const options = game.gameOptions;
      return game.draftDeadline === undefined && (
        ((game.phase === Phase.DRAFTING || game.phase === Phase.INITIALDRAFTING) && (options?.draftTimeLimit ?? 0) > 0) ||
        (game.phase === Phase.RESEARCH && game.generation > 1 && (options?.buyTimeLimit ?? 0) > 0));
    },
    watchOtherPlayers() {
      const playerView = this.playerView;
      window.clearTimeout(otherPlayersTimer);
      // Schedule the next poll only after this one finishes, so responses can't arrive out of order.
      const timer = window.setTimeout(async () => {
        try {
          const response = await fetch(paths.API_PLAYER + window.location.search);
          if (response.ok) {
            const latest: PlayerViewModel = await response.json();
            if (otherPlayersTimer !== timer || this.playerView !== playerView) {
              return;
            }
            playerView.players = latest.players;
            // The draft clock starts when another player picks: show it to this player too.
            if (latest.game !== undefined) {
              playerView.game.draftDeadline = latest.game.draftDeadline;
              playerView.game.paused = latest.game.paused;
            }
            // A timed pick can advance the whole draft straight to the next question.
            if ((latest.requestId !== undefined && (playerView as Partial<PlayerViewModel>).requestId !== latest.requestId) ||
              (latest.game !== undefined && playerView.game.phase !== latest.game.phase) ||
              (playerView.thisPlayer?.needsToDraft === true && latest.thisPlayer?.needsToDraft === false) ||
              (this.waitingfor !== undefined && latest.waitingFor === undefined)) {
              if (await vueRoot(this).updatePlayer()) {
                return;
              }
            }
          } else {
            console.warn('Unable to update other players', response.status, response.statusText);
            // Client errors (e.g. the game no longer exists) won't recover, so stop polling.
            if (response.status < 500) {
              return;
            }
          }
        } catch (e) {
          console.warn('Unable to update other players', e);
        }
        // Stop if the component unmounted or another poll started while this one was in flight.
        if (otherPlayersTimer === timer) {
          this.watchOtherPlayers();
        }
      }, this.clockPossible() ? FAST_PLAYERS_INTERVAL : OTHER_PLAYERS_INTERVAL);
      otherPlayersTimer = timer;
    },
    notify() {
      if (getPreferences().enable_sounds) {
        SoundManager.playActivePlayerSound();
      }

      if (Notification.permission !== 'granted') {
        Notification.requestPermission();
      } else if (Notification.permission === 'granted') {
        const notificationOptions = {
          icon: 'favicon.ico',
          body: 'It\'s your turn!',
        };
        const notificationTitle = constants.APP_NAME;
        try {
          new Notification(notificationTitle, notificationOptions);
        } catch (e) {
          // ok so the native Notification doesn't work which will happen
          // try to use the service worker
          if (!window.isSecureContext || !navigator.serviceWorker) {
            return;
          }
          navigator.serviceWorker.ready.then((registration) => {
            registration.showNotification(notificationTitle, notificationOptions);
          }).catch((err) => {
            // avoid promise going uncaught
            console.warn('Failed to display notification with serviceWorker', err);
          });
        }
      }
    },
    playerName(color: Color) {
      const player = this.playerView.players.find((p) => p.color === color);
      return player?.name ?? '';
    },
  },
  mounted() {
    this.start();
    this.openDeckDialog();
  },
  beforeUnmount() {
    this.stop();
  },
  computed: {
    paused(): boolean {
      return this.playerView.game.paused !== undefined;
    },
    /** Cards that are simply received (nothing to choose): no "Show the game" in their window. */
    preludeChoice(): boolean {
      return this.waitingfor?.type === 'card' && this.waitingfor.title === 'Select prelude card to play';
    },
    cardsAllGiven(): boolean {
      const input = this.waitingfor;
      return input?.type === 'card' && input.min === input.cards.length && (input.max ?? input.cards.length) === input.cards.length;
    },
    revealShowing(): boolean {
      return revealOpen.value;
    },
    showDeckDialog(): boolean {
      return this.centerDeckChoice && !this.hideInput && showsCards(this.waitingfor) && !this.draftRepick;
    },
    draftRepick(): boolean {
      return isDraftRepick(this.waitingfor);
    },
    draftPlayers(): Array<string> {
      return this.playerView.players.filter((player) => player.needsToDraft === true).map((player) => player.name);
    },
    Phase(): typeof Phase {
      return Phase;
    },
    playerColorClass(): typeof playerColorClass {
      return playerColorClass;
    },
  },
});

</script>

