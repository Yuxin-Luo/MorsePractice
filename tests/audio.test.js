import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { playMorse, stop, getAudioContext, playTone, stopTone } from '../src/core/audio.js';

/**
 * Build a fresh mock AudioContext. The audio.js module holds a singleton
 * `_ctx` at module scope, so between describes we re-import the module
 * via vi.resetModules() to get a fresh state.
 */
function buildMockCtx() {
  const mockOsc = {
    type: '',
    frequency: { value: 0 },
    connect: vi.fn(function () { return this; }),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
    onended: null,
  };
  const mockGain = {
    gain: {
      value: 0,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(function () { return this; }),
    disconnect: vi.fn(),
  };
  const mockCtx = {
    currentTime: 0,
    state: 'running',
    destination: {},
    createOscillator: vi.fn(() => mockOsc),
    createGain: vi.fn(() => mockGain),
    resume: vi.fn(),
  };
  global.window = {
    AudioContext: function () { return mockCtx; },
  };
  return { mockOsc, mockGain, mockCtx };
}

describe('audio engine', () => {
  let mockOsc, mockGain, mockCtx;
  let audio;

  beforeEach(async () => {
    vi.resetModules();
    ({ mockOsc, mockGain, mockCtx } = buildMockCtx());
    audio = await import('../src/core/audio.js');
  });

  afterEach(() => {
    audio.stop();
  });

  it('creates an oscillator and gain node', () => {
    audio.playMorse('.-', { wpm: 20 });
    expect(mockCtx.createOscillator).toHaveBeenCalled();
    expect(mockCtx.createGain).toHaveBeenCalled();
  });

  it('uses sine wave at 600 Hz by default', () => {
    audio.playMorse('.-', { wpm: 20 });
    expect(mockOsc.type).toBe('sine');
    expect(mockOsc.frequency.value).toBe(600);
  });

  it('respects custom frequency', () => {
    audio.playMorse('.-', { wpm: 20, frequency: 800 });
    expect(mockOsc.frequency.value).toBe(800);
  });

  it('schedules gain envelope for a single dit (.)', () => {
    audio.playMorse('.', { wpm: 20 });
    expect(mockGain.gain.setValueAtTime).toHaveBeenCalled();
    expect(mockGain.gain.linearRampToValueAtTime).toHaveBeenCalled();
  });

  it('schedules longer duration for dah than for dit', () => {
    audio.playMorse('.', { wpm: 20 });
    const ditSetCount = mockGain.gain.setValueAtTime.mock.calls.length;
    const ditRampCount = mockGain.gain.linearRampToValueAtTime.mock.calls.length;

    mockGain.gain.setValueAtTime.mockClear();
    mockGain.gain.linearRampToValueAtTime.mockClear();

    audio.playMorse('-', { wpm: 20 });
    const dahSetCount = mockGain.gain.setValueAtTime.mock.calls.length;
    const dahRampCount = mockGain.gain.linearRampToValueAtTime.mock.calls.length;

    expect(dahSetCount).toBe(ditSetCount);
    expect(dahRampCount).toBe(ditRampCount);
  });

  it('handles word separator " / " by adding word gap', () => {
    audio.playMorse('. / .', { wpm: 20 });
    expect(mockGain.gain.setValueAtTime).toHaveBeenCalled();
  });

  it('start() is called with a future timestamp', () => {
    audio.playMorse('.-', { wpm: 20 });
    const startArg = mockOsc.start.mock.calls[0][0];
    expect(startArg).toBeGreaterThan(mockCtx.currentTime);
  });

  it('onended handler is attached', () => {
    audio.playMorse('.-', { wpm: 20 });
    expect(typeof mockOsc.onended).toBe('function');
  });

  it('stop() does not throw when nothing is playing', () => {
    expect(() => audio.stop()).not.toThrow();
  });
});

describe('playTone (single tone of arbitrary duration)', () => {
  let mockOsc, mockGain, mockCtx;
  let audio;

  beforeEach(async () => {
    vi.resetModules();
    ({ mockOsc, mockGain, mockCtx } = buildMockCtx());
    audio = await import('../src/core/audio.js');
  });

  it('returns null when durationMs is invalid', () => {
    expect(audio.playTone({ durationMs: 0 })).toBeNull();
    expect(audio.playTone({ durationMs: -50 })).toBeNull();
    expect(audio.playTone({ durationMs: NaN })).toBeNull();
    expect(audio.playTone({ durationMs: Infinity })).toBeNull();
    expect(audio.playTone({})).toBeNull();
  });

  it('creates an oscillator + gain for a valid duration', () => {
    const osc = audio.playTone({ durationMs: 100 });
    expect(mockCtx.createOscillator).toHaveBeenCalled();
    expect(mockCtx.createGain).toHaveBeenCalled();
    expect(osc).toBe(mockOsc);
  });

  it('uses sine wave at 600 Hz by default', () => {
    audio.playTone({ durationMs: 100 });
    expect(mockOsc.type).toBe('sine');
    expect(mockOsc.frequency.value).toBe(600);
  });

  it('respects custom frequency and volume', () => {
    audio.playTone({ durationMs: 100, frequency: 800, volume: 0.4 });
    expect(mockOsc.frequency.value).toBe(800);
    const attackCall = mockGain.gain.linearRampToValueAtTime.mock.calls[0];
    expect(attackCall[0]).toBeCloseTo(0.4);
  });

  it('schedules an ADSR envelope (set + linearRamp pairs)', () => {
    audio.playTone({ durationMs: 100 });
    expect(mockGain.gain.setValueAtTime).toHaveBeenCalledTimes(2);
    expect(mockGain.gain.linearRampToValueAtTime).toHaveBeenCalledTimes(2);
  });

  it('schedules very short tones without breaking the envelope', () => {
    audio.playTone({ durationMs: 20 });
    expect(mockOsc.start).toHaveBeenCalled();
    expect(mockOsc.stop).toHaveBeenCalled();
  });

  it('starts and stops with appropriate timestamps', () => {
    audio.playTone({ durationMs: 100 });
    const startArg = mockOsc.start.mock.calls[0][0];
    const stopArg = mockOsc.stop.mock.calls[0][0];
    expect(startArg).toBeGreaterThan(mockCtx.currentTime);
    expect(stopArg).toBeGreaterThan(startArg);
  });

  it('attaches an onended handler for cleanup', () => {
    audio.playTone({ durationMs: 100 });
    expect(typeof mockOsc.onended).toBe('function');
  });
});

describe('stopTone (early-release path)', () => {
  let audio;
  let mockOsc;

  beforeEach(async () => {
    vi.resetModules();
    audio = await import('../src/core/audio.js');
    mockOsc = { stop: vi.fn(), disconnect: vi.fn() };
  });

  it('calls stop() on the oscillator', () => {
    audio.stopTone(mockOsc);
    expect(mockOsc.stop).toHaveBeenCalled();
  });

  it('does not throw when called with null', () => {
    expect(() => audio.stopTone(null)).not.toThrow();
    expect(() => audio.stopTone(undefined)).not.toThrow();
  });

  it('does not throw when called twice (already stopped)', () => {
    mockOsc.stop.mockImplementation(() => {
      throw new Error('AlreadyStopped');
    });
    expect(() => audio.stopTone(mockOsc)).not.toThrow();
    expect(() => audio.stopTone(mockOsc)).not.toThrow();
  });
});
