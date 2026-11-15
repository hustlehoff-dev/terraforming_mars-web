<template>
  <div class="preference-fields">
    <details v-for="group in shownGroups" :key="group.title" class="preference-fields__group" :open="group.title === 'Audio' || !mission">
      <summary>{{ $t(group.title) }}</summary>
      <div v-if="group.title === 'Audio' && mission" class="preference-fields__volume">
        <label>
          <span>{{ $t('Music volume') }} <span class="preference-fields__value">{{ prefs.music_volume }}%</span></span>
          <input type="range" min="0" max="100" :value="prefs.music_volume" @input="setMusicVolume">
        </label>
        <label class="preference-fields__language">
          <span>{{ $t('Music track') }}</span>
          <select :value="prefs.music_track" @change="setMusicTrack">
            <option value="builtin">{{ $t('Game soundtrack (built in)') }}</option>
            <option value="url">{{ $t('Link to an audio file') }}</option>
            <option value="file">{{ $t('My own file') }}</option>
          </select>
        </label>
        <form v-if="prefs.music_track === 'url'" class="preference-fields__music" @submit.prevent="applyMusicUrl">
          <input v-model="musicUrl" type="url" :placeholder="$t('https://... .mp3 or .ogg')" :aria-label="$t('Link to an audio file')">
          <button type="submit">{{ $t('Play') }}</button>
          <small>{{ $t('A direct link to the file (ends with .mp3, .ogg...), not a YouTube or Spotify page.') }}</small>
        </form>
        <div v-if="prefs.music_track === 'file'" class="preference-fields__music">
          <input type="file" accept="audio/*" :aria-label="$t('My own file')" @change="chooseMusicFile">
          <small>{{ musicFileNote || $t('The file stays in this browser.') }}</small>
        </div>
      </div>
      <label v-for="field in group.fields" :key="field.key" class="preference-fields__toggle">
        <span :title="field.hint ? $t(field.hint) : undefined">{{ $t(field.label) }}</span>
        <input type="checkbox" :checked="prefs[field.key]" :data-test="field.key" @change="setToggle(field.key, $event)">
      </label>
      <template v-if="group.title === 'Display' && mission">
        <label class="preference-fields__language">
          <span>{{ $t('Tile ownership') }}</span>
          <select :value="prefs.map_owner_square ? 'square' : prefs.map_owner_ring ? 'ring' : 'border'" @change="setOwnerMarker">
            <option value="square">{{ $t('Square marker') }}</option>
            <option value="border">{{ $t('Colored border') }}</option>
            <option value="ring">{{ $t('Colored border and inner ring') }}</option>
          </select>
        </label>
        <label class="preference-fields__volume">
          <span>{{ $t('Size of the cards in hand') }} <span class="preference-fields__value">{{ prefs.hand_card_size }}%</span></span>
          <input type="range" min="70" max="150" step="5" :value="prefs.hand_card_size" @input="setHandSize">
        </label>
      </template>
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
import {computed, ref} from 'vue';
import {SoundManager} from '@/client/utils/SoundManager';
import {saveOwnTrack} from '@/client/utils/musicStore';
import {translateText} from '@/client/directives/i18n';
import {Preferences, PreferencesManager} from '@/client/utils/PreferencesManager';
import {ALL_LANGUAGES, LANGUAGES} from '@/common/constants';

type ToggleKey = {[K in keyof Preferences]: Preferences[K] extends boolean ? K : never}[keyof Preferences];
type Toggle = {key: ToggleKey; label: string; hint?: string};

const props = defineProps<{preferencesManager: PreferencesManager; mission?: boolean}>();
const prefs = computed(() => props.preferencesManager.values());

const soundToggle: Toggle = {key: 'enable_sounds', label: 'Enable sounds'};
// The game menu (mission): only what works on the game screen.
const missionGroups: Array<{title: string; fields: Toggle[]}> = [
  {title: 'Audio', fields: [soundToggle, {key: 'enable_music', label: 'Music'}]},
  {title: 'Display', fields: [
    {key: 'hide_awards_and_milestones', label: 'Hide awards and milestones'},
    {key: 'hide_discount_on_cards', label: 'Hide discount on cards'},
    {key: 'remove_background', label: 'Remove background image'},
    {key: 'symbol_overlay', label: 'Symbol Overlay', hint: 'Add symbols on top of player colors.'},
  ]},
  {title: 'Gameplay', fields: [
    {key: 'show_alerts', label: 'Show in-game alerts'},
    {key: 'hide_tile_confirmation', label: 'Hide tile confirmation'},
    {key: 'learner_mode', label: 'Learner Mode', hint: 'Show information that can be helpful\n to players who are still learning the games'},
    {key: 'animated_title', label: 'Animated Title', hint: 'Show spinning circle in window title on your turn.'},
  ]},
];
const groups: Array<{title: string; fields: Toggle[]}> = [
  {title: 'Audio', fields: [soundToggle, {key: 'enable_music', label: 'Music'}]},
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

const shownGroups = computed(() => props.mission ? missionGroups : groups);

function setHandSize(event: Event) {
  props.preferencesManager.set('hand_card_size', (event.target as HTMLInputElement).valueAsNumber);
}

function setToggle(key: ToggleKey, event: Event) {
  props.preferencesManager.set(key, (event.target as HTMLInputElement).checked);
}

const musicUrl = ref(prefs.value.music_url);
const musicFileNote = ref('');

function setMusicTrack(event: Event) {
  props.preferencesManager.set('music_track', (event.target as HTMLSelectElement).value);
  SoundManager.restartMissionAmbience();
}

function applyMusicUrl() {
  props.preferencesManager.set('music_url', musicUrl.value.trim());
  SoundManager.restartMissionAmbience();
}

async function chooseMusicFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file === undefined) {
    return;
  }
  await saveOwnTrack(file);
  musicFileNote.value = `${translateText('Playing')}: ${file.name}`;
  SoundManager.restartMissionAmbience();
}

function setMusicVolume(event: Event) {
  props.preferencesManager.set('music_volume', (event.target as HTMLInputElement).valueAsNumber);
}

function setOwnerMarker(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  props.preferencesManager.set('map_owner_square', value === 'square');
  props.preferencesManager.set('map_owner_ring', value === 'ring');
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

<style lang="less">
.preference-fields__music {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6px;
  margin-top: 6px;

  input[type='url'],
  input[type='file'] {
    min-width: 0;
  }

  input[type='file'] {
    grid-column: 1 / -1;
  }

  small {
    grid-column: 1 / -1;
    opacity: 0.75;
  }
}
</style>

