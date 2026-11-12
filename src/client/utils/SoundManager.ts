import {getPreferences} from '@/client/utils/PreferencesManager';

export namespace SoundManager {
  type MissionCue = 'sector' | 'card' | 'project' | 'placement' | 'turn';

  let context: AudioContext | undefined;
  let windBuffer: AudioBuffer | undefined;
  let ambience: AudioBufferSourceNode | undefined;
  let ambienceRequested = false;

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

  function noise(audio: AudioContext, frequency: number, volume: number, duration?: number) {
    if (windBuffer === undefined) {
      windBuffer = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate);
      const samples = windBuffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.random() * 2 - 1;
      }
    }
    const source = audio.createBufferSource();
    source.buffer = windBuffer;
    source.loop = duration === undefined;
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = frequency;
    const gain = audio.createGain();
    const start = audio.currentTime;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + (duration === undefined ? 0.7 : 0.015));
    source.connect(filter).connect(gain).connect(audio.destination);
    source.start(start);
    if (duration !== undefined) {
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      source.stop(start + duration);
    }
    return source;
  }

  export function startMissionAmbience() {
    ambienceRequested = true;
    playInContext((audio) => {
      if (ambienceRequested && ambience === undefined && !document.hidden) {
        ambience = noise(audio, 190, 0.12);
      }
    }, true);
  }

  export function stopMissionAmbience() {
    ambienceRequested = false;
    ambience?.stop();
    ambience = undefined;
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
