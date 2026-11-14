<template>
  <button type="button" class="dialog-peek" :aria-pressed="peeking" @click="toggle">
    <span aria-hidden="true">{{ peeking ? '▣' : '👁' }}</span>
    {{ peeking ? $t('Back to the choice') : $t('Show the game') }}
  </button>
</template>

<script setup lang="ts">
import {getCurrentInstance, onBeforeUnmount, ref} from 'vue';

/*
 * A large button inside a game window (deck choice, card reveal, HUD menus) that hides the window
 * so the player can look at the game, and brings it back. The dialog stays open the whole time.
 */
const peeking = ref(false);
const instance = getCurrentInstance();

function dialog(): HTMLDialogElement | null {
  const element = instance?.proxy?.$el as HTMLElement | undefined;
  return element?.closest('dialog') ?? null;
}

// While peeking the window is shown non-modally, so the game underneath (e.g. hovering the hand) works.
let wasModal = false;
function toggle() {
  const element = dialog();
  peeking.value = !peeking.value;
  element?.classList.toggle('dialog--peek', peeking.value);
  if (element === null || !element.open) {
    return;
  }
  if (peeking.value) {
    wasModal = element.matches(':modal');
    if (wasModal) {
      element.close();
      element.show();
    }
  } else if (wasModal) {
    element.close();
    element.showModal();
  }
}

onBeforeUnmount(() => dialog()?.classList.remove('dialog--peek'));
</script>

<style scoped lang="less">
.dialog-peek {
  // Below the window's content, kept in view at the bottom of the window while it scrolls.
  position: sticky;
  z-index: 2;
  bottom: 8px;
  margin: 16px auto 4px;
  display: flex;
  width: fit-content;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border: 1px solid #e2c27f;
  border-radius: 10px;
  background: linear-gradient(#1c2f3f, #0b141c);
  box-shadow: 0 0 14px #e2c27f44, 0 6px 16px #000b;
  color: #ffe9bd;
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  visibility: visible !important;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    outline: none;
    border-color: #fff3c4;
  }
}
</style>

<style lang="less">
// While peeking, everything in the window except the button is hidden and the game shows through.
dialog.dialog--peek {
  // Shown non-modally while peeking, a dialog would drop into the page flow (below the screen,
  // making the page scroll). Keep it exactly where the modal window was.
  position: fixed;
  z-index: 100;
  inset: 0;
  margin: auto;
  background: none !important;
  box-shadow: none !important;
  pointer-events: none;

  &::backdrop {
    background: transparent !important;
    backdrop-filter: none !important;
  }

  * {
    visibility: hidden;
  }

  .dialog-peek,
  .dialog-peek * {
    visibility: visible;
    pointer-events: auto;
  }
}
</style>
