<template>
  <button type="button" class="mission-settings-trigger" :aria-label="$t('Player Settings')" :title="$t('Player Settings')"
    aria-haspopup="dialog" @click="openSettings">
    <span aria-hidden="true"></span>
  </button>

  <dialog ref="dialog" class="mission-settings" aria-labelledby="mission-settings-title" @click.self="close" @keydown.stop>
    <div class="mission-settings__panel">
      <header>
        <h2 id="mission-settings-title" v-i18n>Player Settings</h2>
        <button type="button" class="mission-settings__close" :aria-label="$t('Close')" autofocus @click="close">×</button>
      </header>
      <div class="mission-settings__body">
        <PreferenceFields :preferencesManager="PreferencesManager.INSTANCE" mission />
      </div>
      <!-- Ending the game early: anyone can surrender, the creator can end it with the score. -->
      <section v-if="playerId" class="mission-settings__end">
        <h3 v-i18n>End the game</h3>
        <div class="mission-settings__end-buttons">
          <button type="button" class="mission-settings__danger" :disabled="ending" @click="surrenderConfirm?.show()">
            <span aria-hidden="true">🏳</span>{{ $t('Surrender') }}
          </button>
          <button v-if="isCreator" type="button" class="mission-settings__danger" :disabled="ending" @click="endConfirm?.show()">
            <span aria-hidden="true">⏹</span>{{ $t('End the game with the score') }}
          </button>
        </div>
        <p v-if="!isCreator" class="mission-settings__end-note" v-i18n>Only the creator of the game can end it with the score.</p>
        <p v-if="endError" class="mission-settings__end-error">{{ endError }}</p>
      </section>
      <footer>
        <a href="help" target="_blank" rel="noopener" v-i18n>Player aid</a>
        <button type="button" @click="bugDialog?.show()" v-i18n>Report a bug</button>
      </footer>
    </div>
    <BugReportDialog ref="bugDialog" />
    <ConfirmDialog ref="surrenderConfirm" message="Surrender? You are placed last and the game ends for everyone." @accept="endGame('surrender')" />
    <ConfirmDialog ref="endConfirm" message="End the game now? It is scored as it stands, without final production and greeneries." @accept="endGame('ended')" />
  </dialog>
</template>

<script setup lang="ts">
import {ref} from 'vue';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import PreferenceFields from '@/client/components/PreferenceFields.vue';
import BugReportDialog from '@/client/components/BugReportDialog.vue';
import ConfirmDialog from '@/client/components/common/ConfirmDialog.vue';
import {paths} from '@/common/app/paths';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {translateText} from '@/client/directives/i18n';

const dialog = ref<HTMLDialogElement>();
const bugDialog = ref<InstanceType<typeof BugReportDialog>>();
const surrenderConfirm = ref<InstanceType<typeof ConfirmDialog>>();
const endConfirm = ref<InstanceType<typeof ConfirmDialog>>();

// The player of this page (player?id=p...): spectators get no end game buttons.
const pageId = new URLSearchParams(window.location.search).get('id') ?? '';
const playerId = pageId.startsWith('p') ? pageId : undefined;
const isCreator = ref(false);
const ending = ref(false);
const endError = ref<string>();

async function openSettings() {
  dialog.value?.showModal();
  if (playerId === undefined) {
    return;
  }
  try {
    const response = await fetch(`${paths.API_PLAYER}?id=${playerId}`);
    if (response.ok) {
      const view = await response.json() as PlayerViewModel;
      isCreator.value = view.isGameCreator === true;
    }
  } catch {
    // Without the answer only surrendering is offered.
  }
}

async function endGame(kind: 'surrender' | 'ended') {
  if (playerId === undefined) {
    return;
  }
  ending.value = true;
  endError.value = undefined;
  try {
    const response = await fetch(`${paths.API_END_GAME}?id=${playerId}&kind=${kind}`);
    if (!response.ok) {
      endError.value = translateText('The game could not be ended.');
      return;
    }
    window.location.href = `the-end?id=${playerId}`;
  } catch {
    endError.value = translateText('The game could not be ended.');
  } finally {
    ending.value = false;
  }
}

function close() {
  dialog.value?.close();
}
</script>

<style scoped lang="less">
.mission-settings-trigger {
  position: absolute;
  z-index: 110;
  top: 14px;
  right: clamp(14px, 2.5vw, 36px);
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  padding: 0;
  border: 1px solid #78c8c26e;
  border-radius: 4px;
  background: #0c191fd9;
  color: #aef9ed;
  cursor: pointer;

  span,
  span::before,
  span::after {
    display: block;
    height: 2px;
    border-radius: 1px;
    background: currentColor;
  }

  span {
    position: relative;
    width: 18px;
    transform: skewX(-21deg);

    &::before,
    &::after {
      position: absolute;
      left: 0;
      content: '';
    }

    &::before {
      top: -5px;
      width: 100%;
    }

    &::after {
      top: 5px;
      width: 70%;
    }
  }
}

.mission-settings {
  --settings-accent: #79f3e2;
  --settings-divider: #80c8c638;

  position: fixed;
  inset: max(12px, env(safe-area-inset-top)) clamp(12px, 3vw, 42px) auto auto;
  width: min(420px, calc(100% - 24px));
  max-width: none;
  max-height: calc(100dvh - max(12px, env(safe-area-inset-top)) - 12px);
  margin: 0;
  padding: 0;
  overflow: auto;
  border: 2px solid #6be4d7;
  border-radius: 5px 19px 5px 5px;
  background: linear-gradient(140deg, #173642cc, #08151ee8 54%);
  box-shadow: 0 0 21px #65e5d44a, inset 0 0 25px #5dd9cf16, 0 18px 60px #000a;
  color: #eaf4f4;
  font-family: Ubuntu, system-ui, sans-serif;
  backdrop-filter: blur(18px) saturate(1.22);
  color-scheme: dark;
  overscroll-behavior: contain;

  &::backdrop {
    background: #030b1452;
    backdrop-filter: blur(5px);
  }

  header,
  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 13px 20px;
  }

  header {
    border-bottom: 1px solid var(--settings-divider);
    background: linear-gradient(110deg, #3e928a26, transparent 64%);
  }

  h2 {
    margin: 0;
    color: #f1fafb;
    font-size: 1.22rem;
    font-weight: 600;
  }

  footer {
    flex-wrap: wrap;
    border-top: 1px solid var(--settings-divider);
  }

  footer a,
  footer button {
    padding: 4px 0;
    border: 0;
    background: transparent;
    color: #acd4d5;
    font: inherit;
    cursor: pointer;
    text-decoration: none;

    &:hover {
      color: var(--settings-accent);
      text-decoration: underline;
    }
  }
}

.mission-settings__body {
  padding: 15px 20px;
}

.mission-settings__end {
  padding: 13px 20px 15px;
  border-top: 1px solid var(--settings-divider);

  h3 {
    margin: 0 0 10px;
    color: #ffcfc2;
    font-size: 0.95rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
}

.mission-settings__end-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.mission-settings__danger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border: 1px solid #ff7a5c;
  border-radius: 6px;
  background: #3a120b;
  color: #ffd2c4;
  font: inherit;
  font-weight: 700;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: #5a1a0f;
  }

  &:disabled {
    opacity: 0.6;
    cursor: wait;
  }
}

.mission-settings__end-note {
  margin: 8px 0 0;
  color: #9fb8c2;
  font-size: 0.8rem;
}

.mission-settings__end-error {
  margin: 8px 0 0;
  color: #ff9c86;
}

.mission-settings__close {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  padding: 0;
  border: 1px solid var(--settings-divider);
  border-radius: 3px;
  background: #11232c;
  color: var(--settings-accent);
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
}

.mission-settings-trigger:hover,
.mission-settings-trigger:focus-visible,
.mission-settings__close:hover,
.mission-settings__close:focus-visible {
  border-color: #79f3e2;
  outline: 1px solid #79f3e2;
  outline-offset: 2px;
}
</style>
