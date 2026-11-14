import {getPreferences} from '@/client/utils/PreferencesManager';
import {loadOwnTrack} from '@/client/utils/musicStore';

export namespace SoundManager {
  type MissionCue = 'sector' | 'card' | 'project' | 'placement' | 'turn';

  let context: AudioContext | undefined;
  let noiseBuffer: AudioBuffer | undefined;
  let ambienceRequested = false;
  /** A chosen track (link or own file) plays in an audio element: links from other sites work without CORS. */
  let customAudio: HTMLAudioElement | undefined;
  let customUrl: string | undefined;
  let sourceRequest = 0;

  async function customSource(): Promise<string | undefined> {
    const prefs = getPreferences();
    if (prefs.music_track === 'url') {
      return prefs.music_url.trim() || undefined;
    }
    if (prefs.music_track === 'file') {
      const blob = await loadOwnTrack();
      if (blob === undefined) {
        return undefined;
      }
      if (customUrl !== undefined) {
        URL.revokeObjectURL(customUrl);
      }
      customUrl = URL.createObjectURL(blob);
      return customUrl;
    }
    return undefined;
  }

  /**
   * The game's own playlist: "Red Planet Stillness" first, then the "Quiet Expansion" pieces,
   * then around again.
   */
  const PLAYLIST: ReadonlyArray<string> = [
    '/assets/audio/red-planet-stillness-01.mp3',
    '/assets/audio/quiet-expansion-01.mp3',
    '/assets/audio/quiet-expansion-02.mp3',
  ];

  function startPlaylist(index = 0) {
    startCustom(PLAYLIST[index % PLAYLIST.length], () => startPlaylist(index + 1));
  }

  function startCustom(src: string, onEnded?: () => void) {
    const audio = new Audio(src);
    const request = sourceRequest;
    audio.loop = onEnded === undefined;
    if (onEnded !== undefined) {
      audio.addEventListener('ended', () => {
        if (customAudio === audio && ambienceRequested) {
          onEnded();
        }
      });
    }
    audio.volume = 0;
    customAudio = audio;
    void audio.play().then(() => {
      const started = performance.now();
      const fade = () => {
        if (customAudio !== audio || request !== sourceRequest) {
          return;
        }
        const k = Math.min(1, (performance.now() - started) / 2000);
        audio.volume = getPreferences().music_volume / 100 * k;
        if (k < 1) {
          requestAnimationFrame(fade);
        }
      };
      fade();
    }).catch(() => {
      if (customAudio === audio && request === sourceRequest) {
        customAudio = undefined;
        ambienceRequested = false;
      }
    });
  }

  function playInContext(play: (audio: AudioContext) => void, allowResume = false) {
    if (!getPreferences().enable_sounds || !window.AudioContext) {
      return;
    }
    const canResume = allowResume || navigator.userActivation?.hasBeenActive;
    if (context === undefined && !canResume) {
      return;
    }
    const audio = context ??= new AudioContext();
    if (audio.state === 'running') {
      play(audio);
    } else if (canResume) {
      void audio.resume().then(() => {
        if (getPreferences().enable_sounds) {
          play(audio);
        }
      }).catch(() => {});
    }
  }

  function tone(audio: AudioContext, from: number, to: number, delay: number, duration: number, volume: number) {
    const start = audio.currentTime + delay;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  function noise(audio: AudioContext, frequency: number, volume: number, duration: number) {
    if (noiseBuffer === undefined) {
      noiseBuffer = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate);
      const samples = noiseBuffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.random() * 2 - 1;
      }
    }
    const source = audio.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = frequency;
    const gain = audio.createGain();
    const start = audio.currentTime;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.015);
    source.connect(filter).connect(gain).connect(audio.destination);
    source.start(start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.stop(start + duration);
  }

  export function startMissionAmbience() {
    const prefs = getPreferences();
    if (document.hidden || !document.hasFocus() || !prefs.enable_music || !prefs.enable_sounds) {
      return;
    }
    if (ambienceRequested) {
      return;
    }
    ambienceRequested = true;
    if (customAudio !== undefined) {
      const audio = customAudio;
      const request = sourceRequest;
      audio.volume = prefs.music_volume / 100;
      void audio.play().catch(() => {
        if (customAudio === audio && request === sourceRequest) {
          ambienceRequested = false;
        }
      });
      return;
    }
    if (prefs.music_track === 'builtin') {
      startPlaylist();
      return;
    }
    const request = ++sourceRequest;
    void customSource().then((src) => {
      if (request === sourceRequest) {
        if (src === undefined) {
          ambienceRequested = false;
        } else {
          startCustom(src);
        }
      }
    });
  }

  export function pauseMissionAmbience() {
    ambienceRequested = false;
    sourceRequest++;
    customAudio?.pause();
  }

  export function stopMissionAmbience() {
    pauseMissionAmbience();
    customAudio = undefined;
  }

  /** The chosen track changed: play the new one straight away. */
  export function restartMissionAmbience() {
    stopMissionAmbience();
    startMissionAmbience();
  }

  export function setMissionMusicVolume(volume: number) {
    if (customAudio !== undefined) {
      customAudio.volume = Math.max(0, Math.min(1, volume / 100));
    }
  }

  export function mission(cue: MissionCue) {
    playInContext((audio) => {
      switch (cue) {
      case 'sector':
        tone(audio, 520, 355, 0, 0.095, 0.10);
        break;
      case 'card':
        noise(audio, 1600, 0.20, 0.19);
        tone(audio, 300, 610, 0.025, 0.16, 0.075);
        break;
      case 'project':
        tone(audio, 220, 180, 0, 0.24, 0.14);
        tone(audio, 392, 523, 0.06, 0.26, 0.09);
        break;
      case 'placement':
        noise(audio, 680, 0.42, 0.38);
        tone(audio, 115, 43, 0, 0.40, 0.25);
        tone(audio, 330, 440, 0.13, 0.32, 0.09);
        break;
      case 'turn':
        tone(audio, 330, 440, 0, 0.18, 0.08);
        tone(audio, 440, 660, 0.10, 0.26, 0.08);
        break;
      }
    }, cue === 'sector' || cue === 'card');
  }

  export function playActivePlayerSound() {
    playInContext((audio) => {
      tone(audio, 523.25, 523.25, 0, 0.4, 0.28);
      tone(audio, 440, 440, 0.2, 0.4, 0.28);
    });
  }

  /** Somebody else has chosen: this player's clock starts. */
  export function clockStarted() {
    playInContext((audio) => {
      tone(audio, 880, 880, 0, 0.14, 0.22);
      tone(audio, 880, 880, 0.18, 0.14, 0.22);
      tone(audio, 1175, 1175, 0.36, 0.22, 0.22);
    });
  }

  /** One of the last seconds on the clock. */
  export function clockTick() {
    playInContext((audio) => tone(audio, 1046, 1046, 0, 0.06, 0.16));
  }

  export function newLog() {
    playInContext((audio) => tone(audio, 196, 196, 0.02, 0.05, 0.10));
  }
}
