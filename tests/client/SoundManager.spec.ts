import {afterEach, describe, expect, it, vi} from 'vitest';

describe('Mars soundtrack', () => {
  afterEach(() => {
    SoundManager.stopMissionAmbience();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  let SoundManager: typeof import('../../src/client/utils/SoundManager').SoundManager;

  it('waits for decoding, respects a stop during loading, and loops only one source on restart', async () => {
    vi.resetModules();
    ({SoundManager} = await import('../../src/client/utils/SoundManager'));
    const connect = vi.fn();
    const start = vi.fn();
    const stop = vi.fn();
    const source = {connect, start, stop, loop: false, loopStart: 0, loopEnd: 0};
    connect.mockReturnValue({connect: vi.fn()});
    const createBufferSource = vi.fn(() => source);
    let finishDecoding!: (buffer: AudioBuffer) => void;
    const decoding = new Promise<AudioBuffer>((resolve) => {
      finishDecoding = resolve;
    });
    const decodeAudioData = vi.fn(() => decoding);
    const fetchTrack = vi.fn(async () => ({ok: true, arrayBuffer: async () => new ArrayBuffer(0)}));
    vi.stubGlobal('fetch', fetchTrack);
    vi.stubGlobal('AudioContext', class {
      state = 'running';
      currentTime = 0;
      decodeAudioData = decodeAudioData;
      createBufferSource = createBufferSource;
      createGain = () => ({gain: {setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn()}});
    });
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);

    SoundManager.startMissionAmbience();
    await vi.waitFor(() => expect(decodeAudioData).toHaveBeenCalledOnce());
    SoundManager.stopMissionAmbience();
    finishDecoding({} as AudioBuffer);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(createBufferSource).not.toHaveBeenCalled();

    SoundManager.startMissionAmbience();
    SoundManager.startMissionAmbience();
    await vi.waitFor(() => expect(start).toHaveBeenCalledOnce());
    expect(fetchTrack).toHaveBeenCalledOnce();
    expect(source.loop).toBe(true);
    SoundManager.stopMissionAmbience();
    expect(stop).toHaveBeenCalledOnce();
  });
});
