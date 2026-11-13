<template>
  <div class="preference-fields">
    <details v-for="group in groups" :key="group.title" class="preference-fields__group" :open="group.title === 'Audio' || !mission">
      <summary>{{ $t(group.title) }}</summary>
      <div v-if="group.title === 'Audio' && mission" class="preference-fields__volume">
        <label>
          <span>{{ $t('Music volume') }} <span class="preference-fields__value">{{ prefs.music_volume }}%</span></span>
          <input type="range" min="0" max="100" :value="prefs.music_volume" @input="setMusicVolume">
        </label>
      </div>
      <label v-for="field in group.fields" :key="field.key" class="preference-fields__toggle">
        <span :title="field.hint ? $t(field.hint) : undefined">{{ $t(field.label) }}</span>
        <input type="checkbox" :checked="prefs[field.key]" :data-test="field.key" @change="setToggle(field.key, $event)">
      </label>
    </details>
    <label v-if="mission" class="preference-fields__language">
      <span>{{ $t('Language') }}</span>
      <select :value="prefs.lang" @change="setLanguage">
        <option v-for="language in ALL_LANGUAGES" :key="language" :value="language">{{ LANGUAGES[language][0] }}</option>
      </select>
    </label>
  </div>
</template>

<script setup lang="ts">
import {computed} from 'vue';
import {Preferences, PreferencesManager} from '@/client/utils/PreferencesManager';
import {ALL_LANGUAGES, LANGUAGES} from '@/common/constants';

type ToggleKey = {[K in keyof Preferences]: Preferences[K] extends boolean ? K : never}[keyof Preferences];
type Toggle = {key: ToggleKey; label: string; hint?: string};

const props = defineProps<{preferencesManager: PreferencesManager; mission?: boolean}>();
const prefs = computed(() => props.preferencesManager.values());

const soundToggle: Toggle = {key: 'enable_sounds', label: 'Enable sounds'};
const groups: Array<{title: string; fields: Toggle[]}> = [
  {title: 'Audio', fields: [soundToggle]},
  {title: 'Display', fields: [
    {key: 'hide_awards_and_milestones', label: 'Hide awards and milestones'},
    {key: 'small_cards', label: 'Smaller cards'},
    {key: 'magnify_cards', label: 'Magnify cards on hover'},
    {key: 'hide_discount_on_cards', label: 'Hide discount on cards'},
    {key: 'remove_background', label: 'Remove background image'},
    {key: 'symbol_overlay', label: 'Symbol Overlay', hint: 'Add symbols on top of player colors.'},
  ]},
  {title: 'Gameplay', fields: [
    {key: 'show_alerts', label: 'Show in-game alerts'},
    {key: 'hide_tile_confirmation', label: 'Hide tile confirmation'},
    {key: 'learner_mode', label: 'Learner Mode', hint: 'Show information that can be helpful\n to players who are still learning the games'},
    {key: 'hide_animated_sidebar', label: 'Hide sidebar notification'},
    {key: 'animated_title', label: 'Animated Title', hint: 'Show spinning circle in window title on your turn.'},
  ]},
  {title: 'Advanced', fields: [
    {key: 'experimental_ui', label: 'Experimental UI', hint: 'Test out any possible new experimental UI features for feedback.'},
    {key: 'debug_view', label: 'Debug View', hint: 'Add information useful for development and debugging.'},
  ]},
];

function setToggle(key: ToggleKey, event: Event) {
  props.preferencesManager.set(key, (event.target as HTMLInputElement).checked);
}

function setMusicVolume(event: Event) {
  props.preferencesManager.set('music_volume', (event.target as HTMLInputElement).valueAsNumber);
}

function setLanguage(event: Event) {
  props.preferencesManager.set('lang', (event.target as HTMLSelectElement).value);
  window.location.reload();
}
</script>

<style scoped lang="less">
.preference-fields__group + .preference-fields__group {
  margin-top: 8px;
  border-top: 1px solid var(--settings-divider, #80c8c638);
}

.preference-fields__group summary {
  padding: 8px 0;
  font-weight: 600;
  cursor: pointer;
}

.preference-fields__toggle,
.preference-fields__language,
.preference-fields__volume label > span {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.preference-fields__toggle,
.preference-fields__language {
  min-height: 34px;
  cursor: pointer;
}

.preference-fields input,
.preference-fields select {
  accent-color: var(--settings-accent, #70eddf);
}

.preference-fields__toggle input {
  width: 17px;
  height: 17px;
  flex: 0 0 auto;
  margin: 0;
  cursor: pointer;
}

.preference-fields__volume input {
  width: 100%;
  margin: 9px 0 5px;
  cursor: pointer;
}

.preference-fields__value {
  color: var(--settings-accent, #70eddf);
  font-variant-numeric: tabular-nums;
}

.preference-fields__language {
  margin-top: 12px;
}

.preference-fields__language select {
  max-width: 65%;
  padding: 5px 8px;
  border: 1px solid #6caba766;
  border-radius: 3px;
  background: #102128;
  color: #ebf7f7;
}
</style>
