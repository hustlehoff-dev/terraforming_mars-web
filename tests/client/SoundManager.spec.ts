import {afterEach, describe, expect, it, vi} from 'vitest';
import {SoundManager} from '@/client/utils/SoundManager';

describe('Mars soundtrack', () => {
  afterEach(() => {
    SoundManager.stopMissionAmbience();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('plays the three MP3 tracks in order, loops the playlist and stops the active track', () => {
    const tracks: Array<FakeAudio> = [];
    class FakeAudio extends EventTarget {
      loop = false;
      volume = 0;
      play = vi.fn(async () => {});
      pause = vi.fn();

      constructor(public src: string) {
        super();
        tracks.push(this);
      }
    }
    vi.stubGlobal('Audio', FakeAudio);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);

    SoundManager.startMissionAmbience();
    SoundManager.startMissionAmbience();
    expect(tracks).toHaveLength(1);
    for (let i = 0; i < 3; i++) {
      expect(tracks[i].loop).toBe(false);
      tracks[i].dispatchEvent(new Event('ended'));
    }
    expect(tracks.map(({src}) => src)).toEqual([
      '/assets/audio/red-planet-stillness-01.mp3',
      '/assets/audio/quiet-expansion-01.mp3',
      '/assets/audio/quiet-expansion-02.mp3',
      '/assets/audio/red-planet-stillness-01.mp3',
    ]);
    SoundManager.setMissionMusicVolume(25);
    expect(tracks[3].volume).toBe(0.25);
    SoundManager.stopMissionAmbience();
    expect(tracks[3].pause).toHaveBeenCalledOnce();
    tracks[3].dispatchEvent(new Event('ended'));
    expect(tracks).toHaveLength(4);
  });
});
