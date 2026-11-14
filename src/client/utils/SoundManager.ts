import {getPreferences} from '@/client/utils/PreferencesManager';
import {loadOwnTrack} from '@/client/utils/musicStore';

export namespace SoundManager {
  type MissionCue = 'sector' | 'card' | 'project' | 'placement' | 'turn';

  let context: AudioContext | undefined;
  let noiseBuffer: AudioBuffer | undefined;
  let soundtrack: Promise<AudioBuffer> | undefined;
  let ambience: AudioBufferSourceNode | undefined;
  let ambienceGain: GainNode | undefined;
  let ambienceRequested = false;
  /** A chosen track (link or own file) plays in an audio element: links from other sites work without CORS. */
  let customAudio: HTMLAudioElement | undefined;
  let customUrl: string | undefined;

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

  function startCustom(src: string) {
    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = 0;
    customAudio = audio;
    void audio.play().then(() => {
      const target = getPreferences().music_volume / 100;
      const started = performance.now();
      const fade = () => {
        if (customAudio !== audio) {
          return;
        }
        const k = Math.min(1, (performance.now() - started) / 2000);
        audio.volume = target * k;
        if (k < 1) {
          requestAnimationFrame(fade);
        }
      };
      fade();
    }).catch(() => {
      if (customAudio === audio) {
        customAudio = undefined;
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

  function loadSoundtrack(audio: AudioContext): Promise<AudioBuffer> {
    return soundtrack ??= fetch('/assets/audio/mars-orbit.mp3').then((response) => {
      if (!response.ok) {
        throw new Error('Could not load the Mars soundtrack');
      }
      return response.arrayBuffer();
    }).then((data) => audio.decodeAudioData(data)).catch((error) => {
      soundtrack = undefined;
      throw error;
    });
  }

  export function startMissionAmbience() {
    ambienceRequested = true;
    if (ambience !== undefined || customAudio !== undefined || document.hidden || !document.hasFocus() || !getPreferences().enable_music || !getPreferences().enable_sounds) {
      return;
    }
    if (getPreferences().music_track !== 'builtin') {
      void customSource().then((src) => {
        if (src === undefined || !ambienceRequested || customAudio !== undefined || document.hidden) {
          return;
        }
        startCustom(src);
      });
      return;
    }
    playInContext((audio) => {
      void loadSoundtrack(audio).then((buffer) => {
        if (!ambienceRequested || ambience !== undefined || document.hidden || !document.hasFocus() || !getPreferences().enable_sounds || !getPreferences().enable_music) {
          return;
        }
        const source = audio.createBufferSource();
        const gain = audio.createGain();
        source.buffer = buffer;
        source.loop = true;
        // The MP3 includes one second of adjacent music at both ends to keep
        // the loop points clear of the encoder's delay and padding.
        source.loopStart = 1;
        source.loopEnd = 61;
        gain.gain.setValueAtTime(0, audio.currentTime);
        gain.gain.linearRampToValueAtTime(getPreferences().music_volume / 100, audio.currentTime + 2);
        source.connect(gain).connect(audio.destination);
        source.onended = () => {
          source.disconnect();
          gain.disconnect();
        };
        source.start(0, source.loopStart);
        ambience = source;
        ambienceGain = gain;
      }).catch(() => {});
    }, true);
  }

  export function stopMissionAmbience() {
    ambienceRequested = false;
    ambience?.stop();
    ambience = undefined;
    ambienceGain = undefined;
    customAudio?.pause();
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
    if (context !== undefined && ambienceGain !== undefined) {
      const now = context.currentTime;
      ambienceGain.gain.cancelScheduledValues(now);
      ambienceGain.gain.setTargetAtTime(volume / 100, now, 0.035);
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

  export function newLog() {
    playInContext((audio) => tone(audio, 196, 196, 0.02, 0.05, 0.10));
  }
}
