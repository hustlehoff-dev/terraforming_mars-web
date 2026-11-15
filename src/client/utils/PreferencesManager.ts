import {reactive} from 'vue';
import {safeLocalStorage} from '@/client/utils/SafeLocalStorage';

// classic: the original Terraforming Mars web cards, 1:1. printed and arena (illustrated mission
// frames) are no longer offered: any stored choice reads as classic.
export const CARD_SKINS = ['classic', 'printed', 'arena'] as const;
export type CardSkin = typeof CARD_SKINS[number];
export const MUSIC_TRACKS = ['builtin', 'url', 'file'] as const;
export type MusicTrack = typeof MUSIC_TRACKS[number];

export type Preferences = {
  learner_mode: boolean,
  enable_sounds: boolean,
  enable_music: boolean,
  music_volume: number,
  magnify_cards: boolean,
  show_alerts: boolean,
  hide_hand: boolean,
  hide_awards_and_milestones: boolean,
  show_milestone_details: boolean,
  show_award_details: boolean,
  hide_top_bar: boolean,
  small_cards: boolean,
  remove_background: boolean,
  hide_active_cards: boolean,
  hide_automated_cards: boolean,
  hide_event_cards: boolean,
  hide_tile_confirmation: boolean,
  hide_discount_on_cards: boolean,
  hide_animated_sidebar: boolean,
  debug_view: boolean,
  symbol_overlay: boolean,
  map_owner_square: boolean,
  /** The old ring inside owned spaces, on top of the coloured border. */
  map_owner_ring: boolean,
  animated_title: boolean,
  experimental_ui: boolean,
  remember_create_game_settings: boolean,
  lang: string,
  card_skin: CardSkin,
  /** Game music: the built-in track, a link to an audio file, or the player's own file. */
  music_track: MusicTrack,
  music_url: string,
  /** Size of the cards in the hand, in percent of the normal size. */
  hand_card_size: number,
}

export type Preference = keyof Preferences;

const PREFERENCES_VERSION_KEY = 'preferences_version';
const PREFERENCES_VERSION = '2';

const defaults: Preferences = {
  learner_mode: true,
  enable_sounds: true,
  enable_music: true,
  music_volume: 65,
  magnify_cards: true,
  show_alerts: true,
  lang: 'pl',
  card_skin: 'classic',
  music_track: 'builtin',
  music_url: '',
  hand_card_size: 100,

  hide_hand: false,
  hide_awards_and_milestones: false,
  show_milestone_details: true,
  show_award_details: true,
  hide_top_bar: false,
  small_cards: false,
  remove_background: false,
  hide_active_cards: false,
  hide_automated_cards: false,
  hide_event_cards: false,
  hide_tile_confirmation: false,
  hide_discount_on_cards: false,
  hide_animated_sidebar: false,

  symbol_overlay: false,
  map_owner_square: true,
  map_owner_ring: false,
  animated_title: true,

  experimental_ui: false,
  debug_view: false,

  remember_create_game_settings: false,
};

export class PreferencesManager {
  public static INSTANCE = new PreferencesManager();
  private readonly _values: Preferences;

  public static resetForTest() {
    this.INSTANCE = new PreferencesManager();
  }

  private constructor() {
    // Reactive so components update when preferences change, without a page refresh.
    this._values = reactive({...defaults});
    for (const key of Object.keys(defaults) as Array<Preference>) {
      const value = safeLocalStorage.getItem(key);
      if (value) {
        this._set(key, value);
      }
    }
    // Settings version 2: the square owner marker and classic cards for everyone.
    if (safeLocalStorage.getItem(PREFERENCES_VERSION_KEY) !== PREFERENCES_VERSION) {
      this.set('map_owner_square', true);
      this.set('map_owner_ring', false);
      this.set('card_skin', 'classic');
      safeLocalStorage.setItem(PREFERENCES_VERSION_KEY, PREFERENCES_VERSION);
    }
  }

  private _set(key: Preference, val: string | boolean | number) {
    if (key === 'lang') {
      this._values.lang = String(val);
    } else if (key === 'card_skin') {
      // Only the classic cards are offered.
      this._values.card_skin = 'classic';
    } else if (key === 'hand_card_size') {
      const size = Number(val);
      this._values.hand_card_size = Number.isFinite(size) ? Math.min(150, Math.max(70, Math.round(size))) : defaults.hand_card_size;
    } else if (key === 'music_track') {
      this._values.music_track = (MUSIC_TRACKS as ReadonlyArray<string>).includes(String(val)) ? val as MusicTrack : defaults.music_track;
    } else if (key === 'music_url') {
      this._values.music_url = String(val);
    } else if (key === 'music_volume') {
      const volume = Number(val);
      this._values.music_volume = Number.isFinite(volume) ? Math.min(100, Math.max(0, Math.round(volume))) : defaults.music_volume;
    } else {
      this._values[key] = typeof(val) === 'boolean' ? val : (val === '1');
    }
  }

  // Making this Readonly means that it's Typescript-impossible to
  // set preferences through the fields themselves.
  values(): Readonly<Preferences> {
    return this._values;
  }

  set(name: Preference, val: string | boolean | number, setOnChange = false): void {
    // Don't set values if nothing has changed.
    if (setOnChange && this._values[name] === val) {
      return;
    }
    this._set(name, val);
    const value = this._values[name];
    safeLocalStorage.setItem(name, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
  }
}

export function getPreferences(): Readonly<Preferences> {
  return PreferencesManager.INSTANCE.values();
}
