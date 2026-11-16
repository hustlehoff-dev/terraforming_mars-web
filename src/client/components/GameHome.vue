<template>
  <div id="game-home" class="game-room">
    <header class="game-room__head">
      <HomeLink class="game-room__brand">Terraforming Mars</HomeLink>
      <h1 v-i18n>The game is ready</h1>
      <p class="game-room__id"><span v-i18n>game id:</span> <code>{{ gameId }}</code></p>
    </header>

    <ol class="game-room__steps">
      <li><b>1</b><span v-i18n>Send every player their own link (Copy link).</span></li>
      <li><b>2</b><span v-i18n>Click Play next to your name to enter the game.</span></li>
      <li><b>3</b><span v-i18n>Keep this page (bookmark it) in case somebody loses their link.</span></li>
    </ol>

    <section class="game-room__players" :aria-label="$t('Players')">
      <div v-for="(player, index) in (game === undefined ? [] : game.players)" :key="player.color" class="game-room__player"
        :class="'game-room__player--' + player.color">
        <span class="game-room__order" :title="$t('Turn order')">{{ index + 1 }}</span>
        <span :class="['game-room__color', getPlayerCubeColorClass(player.color), {'game-room__color--away': !isOnline(player)}]"
          :title="isOnline(player) ? undefined : $t('Not in the game now')">{{ playerSymbol(player.color) }}</span>
        <strong class="game-room__name">{{ player.name }}</strong>
        <button type="button" class="game-room__copy" :class="{'game-room__copy--done': isPlayerUrlCopied(player.id)}" @click="copyUrl(player.id)">
          {{ isPlayerUrlCopied(player.id) ? $t('Copied!') : $t('Copy link') }}
        </button>
        <a class="game-room__play" :href="getHref(player.id)" v-i18n>Play</a>
      </div>
      <button v-if="game !== undefined && game.players.length > 1" type="button" class="game-room__copy-all"
        :class="{'game-room__copy--done': allCopied}" @click="copyAll">
        {{ allCopied ? $t('Copied!') : $t('Copy all links (to send in one message)') }}
      </button>
    </section>

    <p v-if="game !== undefined" class="game-room__spectator">
      <span v-i18n>Spectator (watch only):</span>
      <a :href="getHref(game.spectatorId)" v-i18n>open</a>
      <button type="button" class="game-room__link-button" @click="copyUrl(game.spectatorId)">
        {{ isPlayerUrlCopied(game.spectatorId ?? '') ? $t('Copied!') : $t('Copy link') }}
      </button>
    </p>

    <PurgeWarning :expectedPurgeTimeMs="game.expectedPurgeTimeMs" />

    <details v-if="game !== undefined" class="game-room__settings">
      <summary v-i18n>Game settings</summary>
      <GameSetupDetail :gameOptions="game.gameOptions" :playerNumber="game.players.length" :lastSoloGeneration="game.lastSoloGeneration" />
    </details>
  </div>
</template>

<script lang="ts">

import {defineComponent} from 'vue';
import {SimpleGameModel} from '@/common/models/SimpleGameModel';
import PurgeWarning from '@/client/components/common/PurgeWarning.vue';
import HomeLink from '@/client/components/common/HomeLink.vue';
import {playerColorClass} from '@/common/utils/utils';
import GameSetupDetail from '@/client/components/GameSetupDetail.vue';
import {ParticipantId} from '@/common/Types';
import {Color} from '@/common/Color';
import {playerSymbol} from '@/client/utils/playerSymbol';
import {setDocumentTitle} from '../utils/documentTitle';
import {paths} from '@/common/app/paths';

// taken from https://stackoverflow.com/a/46215202/83336
// The solution to copying to the clipboard in this case is
// 1. create a dummy input
// 2. add the copied text as a value
// 3. select the input
// 4. execute document.execCommand('copy') which does the clipboard thing
// 5. remove the dummy input
function copyToClipboard(text: string): void {
  if (navigator.clipboard !== undefined) {
    void navigator.clipboard.writeText(text).catch(() => legacyCopy(text));
    return;
  }
  legacyCopy(text);
}

function legacyCopy(text: string): void {
  const input = document.createElement('textarea');
  input.value = text;
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  document.body.removeChild(input);
}
const DEFAULT_COPIED_PLAYER_ID = '-1';

export default defineComponent({
  name: 'GameHome',
  props: {
    game: {
      type: Object as () => SimpleGameModel,
      required: true,
    },
  },
  components: {
    HomeLink,
    GameSetupDetail,
    PurgeWarning,
  },

  data() {
    return {
      // Variable to keep the state for the current copied player id. Used to display message of which button and which player playable link is currently in the clipboard
      urlCopiedPlayerId: DEFAULT_COPIED_PLAYER_ID,
      allCopied: false,
      previousViewport: '',
      // The latest "last seen" of every player, refreshed while this page is open.
      seenAgo: {} as Partial<Record<Color, number>>,
      refreshTimer: undefined as number | undefined,
    };
  },
  computed: {
    gameId(): string {
      return this.game !== undefined ? this.game.id.toString() : 'n/a';
    },
  },
  methods: {
    /** The player has their game page open now (it asks the server for news every second or so). */
    isOnline(player: {color: Color, seenAgoMs?: number}): boolean {
      const ago = this.seenAgo[player.color] ?? player.seenAgoMs;
      return ago !== undefined && ago >= 0 && ago < 20_000;
    },
    async refreshSeen(): Promise<void> {
      try {
        const response = await fetch(`${paths.API_GAME}?id=${this.game.id}`);
        if (!response.ok) {
          return;
        }
        const model: SimpleGameModel = await response.json();
        const seen: Partial<Record<Color, number>> = {};
        for (const player of model.players) {
          // -1: never seen (the first answer of the page may be older).
          seen[player.color] = player.seenAgoMs ?? -1;
        }
        this.seenAgo = seen;
      } catch {
        // Next time.
      }
    },
    getTurnOrder(index: number): string {
      if (index === 0) {
        return '1st';
      } else if (index === 1) {
        return '2nd';
      } else if (index === 2) {
        return '3rd';
      } else if (index > 2) {
        return `${index + 1}th`;
      } else {
        return 'n/a';
      }
    },
    setCopiedIdToDefault() {
      this.urlCopiedPlayerId = DEFAULT_COPIED_PLAYER_ID;
    },
    getPlayerCubeColorClass(color: Color): string {
      return playerColorClass(color, 'bg');
    },
    getHref(playerId: ParticipantId): string {
      if (playerId === this.game.spectatorId) {
        return `spectator?id=${playerId}`;
      }
      return `player?id=${playerId}`;
    },
    copyUrl(playerId: ParticipantId | undefined): void {
      if (playerId === undefined) {
        return;
      }
      // Get current location path without game?id=xxxxxxx
      const path = window.location.href.replace(/game\?id=.*/, '');
      copyToClipboard(path + this.getHref(playerId));
      this.urlCopiedPlayerId = playerId;
    },
    /** All player links as one text, e.g. to paste into a group chat. */
    copyAll(): void {
      const path = window.location.href.replace(/game\?id=.*/, '');
      const text = this.game.players.map((player) => `${player.name}: ${path}${this.getHref(player.id)}`).join('\n');
      copyToClipboard(text);
      this.allCopied = true;
      window.setTimeout(() => {
        this.allCopied = false;
      }, 3000);
    },
    isPlayerUrlCopied(playerId: string): boolean {
      return playerId === this.urlCopiedPlayerId;
    },
    playerSymbol(color: Color) {
      return playerSymbol(color);
    },
  },
  mounted() {
    // Reset the copied player id after 3 seconds to hide the "copied" message
    setInterval(this.setCopiedIdToDefault, 3000);
    this.refreshTimer = window.setInterval(() => void this.refreshSeen(), 5000);
    setDocumentTitle(this.game.name);
    // Set the viewport width to width=device-width on the create game form so mobile browsers use their actual CSS viewport width.
    // The current global viewport is width=1260, which prevents the create game form from using the device width on phones.
    // This is a temporary solution in order to make this edit scoped to the create game form.
    // TODO: Once responsiveness covers the whole project, this code should be removed and the tag in index.html should be updated directly.
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport !== null) {
      this.previousViewport = viewport.getAttribute('content') ?? '';
      viewport.setAttribute(
        'content',
        'width=device-width, initial-scale=1, viewport-fit=cover',
      );
    }
  },
  beforeUnmount() {
    window.clearInterval(this.refreshTimer);
    document
      .querySelector('meta[name="viewport"]')
      ?.setAttribute('content', this.previousViewport);
  },
});

</script>

<style scoped lang="less">
.game-room {
  display: grid;
  width: min(760px, calc(100% - 32px));
  gap: 18px;
  margin: 40px auto;
  padding: 28px clamp(16px, 4vw, 36px);
  border: 1px solid #e2c27f66;
  border-radius: 16px;
  background: linear-gradient(#142330f2, #0a1219f2);
  box-shadow: 0 20px 60px #000c;
  color: #eef6f8;
  font-family: Ubuntu, Arial, sans-serif;
}

.game-room__head {
  text-align: center;

  h1 {
    margin: 6px 0 2px;
    color: #fff3c4;
    font-size: 1.8rem;
  }
}

.game-room__brand {
  color: #e2c27f;
  font-size: 0.85rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.game-room__id {
  margin: 0;
  color: #9fb8c2;
  font-size: 0.8rem;

  code {
    color: #cfe0e6;
  }
}

.game-room__steps {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #cfe0e6;
  }

  b {
    display: grid;
    flex: none;
    width: 26px;
    height: 26px;
    place-items: center;
    border-radius: 50%;
    background: #e2c27f;
    color: #1b1200;
  }
}

.game-room__players {
  display: grid;
  gap: 10px;
}

.game-room__player {
  display: grid;
  grid-template-columns: auto auto 1fr auto auto;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid #ffffff22;
  border-radius: 12px;
  background: #0b141ccc;
}

.game-room__order {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 1px solid #6f8c98;
  border-radius: 50%;
  color: #cfe0e6;
  font-weight: 800;
}

.game-room__color {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 6px;
  color: #fff;
  font-weight: 800;

  // Not in the game now: the link was never opened, or the page was closed.
  &--away {
    filter: grayscale(1);
    opacity: 0.35;
  }
}

.game-room__name {
  overflow: hidden;
  font-size: 1.15rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.game-room__copy,
.game-room__copy-all,
.game-room__play,
.game-room__link-button {
  padding: 9px 16px;
  border: 1px solid #6f8c98;
  border-radius: 9px;
  background: linear-gradient(#1c2f3f, #0b141c);
  color: #eef6f8;
  font: inherit;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;

  &:hover {
    border-color: #b4ffeb;
  }
}

.game-room__copy--done {
  border-color: #6be39b;
  color: #b8f5c8;
}

.game-room__play {
  border-color: #e2c27f;
  background: linear-gradient(#5a4116, #2f220c);
  color: #ffe9bd;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.game-room__copy-all {
  justify-self: center;
}

.game-room__spectator {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 0;
  color: #9fb8c2;
  font-size: 0.85rem;

  a {
    color: #a2eeff;
  }
}

.game-room__link-button {
  padding: 4px 10px;
  font-size: 0.8rem;
}

.game-room__settings {
  border-top: 1px solid #ffffff1f;
  padding-top: 12px;

  summary {
    color: #e2c27f;
    font-weight: 700;
    cursor: pointer;
  }
}

@media (max-width: 560px) {
  .game-room__player {
    grid-template-columns: auto auto 1fr;
  }

  .game-room__copy,
  .game-room__play {
    grid-column: span 3;
    text-align: center;
  }
}
</style>

