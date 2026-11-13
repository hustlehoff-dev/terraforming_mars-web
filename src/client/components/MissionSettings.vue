<template>
  <button type="button" class="mission-settings-trigger" :aria-label="$t('Player Settings')" :title="$t('Player Settings')"
    aria-haspopup="dialog" @click="dialog?.showModal()">
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
      <footer>
        <a href="help" target="_blank" rel="noopener" v-i18n>Player aid</a>
        <button type="button" @click="bugDialog?.show()" v-i18n>Report a bug</button>
      </footer>
    </div>
    <BugReportDialog ref="bugDialog" />
  </dialog>
</template>

<script setup lang="ts">
import {ref} from 'vue';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import PreferenceFields from '@/client/components/PreferenceFields.vue';
import BugReportDialog from '@/client/components/BugReportDialog.vue';

const dialog = ref<HTMLDialogElement>();
const bugDialog = ref<InstanceType<typeof BugReportDialog>>();

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
