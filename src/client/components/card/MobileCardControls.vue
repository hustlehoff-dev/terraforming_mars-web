<template>
  <div class="mobile-card-controls">
    <span v-i18n>Cards per row</span>
    <div role="group" :aria-label="$t('Cards per row')">
      <button v-for="columns in [1, 2]" :key="columns" type="button" :aria-pressed="mobileCardColumns === columns"
        @click="setMobileCardColumns(columns)">{{ columns }}</button>
    </div>
    <small v-i18n>Tap the magnifier to enlarge</small>
  </div>
</template>

<script setup lang="ts">
import {mobileCardColumns, setMobileCardColumns} from './mobileCardLayout';
</script>

<style lang="less">
.mobile-card-controls,
.mobile-card-preview {
  display: none;
}

@media (max-width: 760px) {
  body #player-home.mission-setup-mode {
    padding: 0;

    .setup-page {
      width: 100%;
      max-width: none;
      margin: 0;
      padding-inline: 10px;
      box-sizing: border-box;
    }

    .setup-layout {
      grid-template-columns: minmax(0, 1fr);
      gap: 12px;
    }

    .setup-hero {
      min-height: 0;
      margin-inline: -10px;
      padding: 14px 70px 14px 10px;
      border: 0;
      border-radius: 0;
      background: #0a1016;
      box-shadow: none;

      h1 {
        font-size: 1.2rem;
      }
    }

    .setup-hero__kicker,
    .setup-hero__chips,
    .setup-plan,
    .setup-hero__dome {
      display: none;
    }

    .setup-layout__side {
      position: static;
      order: 2;
    }

    .setup-layout__main,
    .setup-section--input,
    .corporation-selection {
      min-width: 0;
      margin: 0;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
    }

    .setup-steps {
      top: 0;
      margin-bottom: 12px;
      padding: 0;
    }

    .corporation-selection__head,
    .corporation-selection__badge {
      display: none;
    }
  }

  body :is(#player-home, .deck-choice-dialog) .mobile-card-browser {
    display: grid !important;
    width: 100%;
    min-width: 0;
    grid-template-columns: repeat(var(--mobile-card-columns, 2), minmax(0, 1fr)) !important;
    align-items: start;
    justify-items: center;
    gap: 12px 10px;
    margin-inline: 0;
    padding-inline: 0;

    > :not(.cardbox, .corporation-selection__option) {
      grid-column: 1 / -1;
      width: 100%;
    }

    > .cardbox,
    > .corporation-selection__option {
      position: relative;
      display: grid;
      width: 100%;
      min-width: 0;
      justify-items: center;
      align-content: start;
      gap: 6px;
      margin: 0;
      padding: 6px 0 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
      transform: none;
      user-select: none;
      -webkit-touch-callout: none;

      > .card-container {
        max-width: none;
        margin: 0 !important;
        zoom: var(--mobile-browser-scale, 0.65);
      }

      > input[type='checkbox'],
      > input[type='radio'] {
        position: absolute;
        width: 1px;
        height: 1px;
        opacity: 0;
      }

      &:has(input:checked) > .card-container,
      &.draft-pick__card--selected > .card-container,
      &.corporation-selection__option--selected > .card-container {
        outline: 3px solid #f3c77e;
        outline-offset: 3px;
        box-shadow: none;
      }

      > .card-container::after {
        display: none;
      }
    }

    > .deck-deal__origin {
      display: none;
    }

    .mobile-card-preview {
      display: grid;
      width: 44px;
      height: 40px;
      justify-self: end;
      place-content: center;
      margin-inline-end: 4px;
      padding: 0;
      border: 1px solid #68818c;
      border-radius: 6px;
      background: #142630;
      color: #f3c77e;
      font-size: 1.2rem;
      cursor: zoom-in;
    }
  }

  body dialog.deck-choice-dialog:has(.mobile-card-browser) {
    box-sizing: border-box;
    width: 100%;
    max-width: none;
    height: 100dvh;
    max-height: 100dvh;
    margin: 0;
    padding: 12px 10px;
    border: 0;
    border-radius: 0;
    overflow: auto;
  }

  body .mobile-card-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    color: #edf3f5;
    font-size: 0.85rem;

    > div {
      display: flex;
      gap: 4px;
    }

    button {
      width: 44px;
      height: 44px;
      padding: 0;
      border: 1px solid #68818c;
      border-radius: 6px;
      background: #142630;
      color: #edf3f5;
      font: inherit;
      font-size: 1rem;
      cursor: pointer;

      &[aria-pressed='true'] {
        border-color: #f3c77e;
        background: #f3c77e;
        color: #21180e;
      }
    }

    small {
      flex-basis: 100%;
      color: #b5c5cc;
      font-size: 0.75rem;
    }
  }
}
</style>
