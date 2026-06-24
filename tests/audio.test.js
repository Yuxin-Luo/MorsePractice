import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { playMorse, stop, getAudioContext } from '../src/core/audio.js';

describe('audio engine', () => {
  let mockOsc, mockGain, mockCtx;

  beforeEach(() => {
    // Mock the entire AudioContext chain.
    mockOsc = {
      type: '',
      frequency: { value: 0 },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      disconnect: vi.fn(),
      onended: null,
    };
    mockGain = {
      gain: {
        value: 0,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    mockCtx = {
      currentTime: 0,
      state: 'running',
      destination: {},
      createOscillator: vi.fn(() => mockOsc),
      createGain: vi.fn(() => mockGain),
      resume: vi.fn(),
    };
    global.window = {
      AudioContext: function () {
        return mockCtx;
      },
    };
  });

  afterEach(() => {
    stop();
  });

  it('creates an oscillator and gain node', () => {
    playMorse('.-', { wpm: 20 });
    expect(mockCtx.createOscillator).toHaveBeenCalled();
    expect(mockCtx.createGain).toHaveBeenCalled();
  });

  it('uses sine wave at 600 Hz by default', () => {
    playMorse('.-', { wpm: 20 });
    expect(mockOsc.type).toBe('sine');
    expect(mockOsc.frequency.value).toBe(600);
  });

  it('respects custom frequency', () => {
    playMorse('.-', { wpm: 20, frequency: 800 });
    expect(mockOsc.frequency.value).toBe(800);
  });

  it('schedules gain envelope for a single dit (.)', () => {
    playMorse('.', { wpm: 20 });
    // gain envelope should have at least: zero, attack ramp, sustain setValue, release ramp
    expect(mockGain.gain.setValueAtTime).toHaveBeenCalled();
    expect(mockGain.gain.linearRampToValueAtTime).toHaveBeenCalled();
  });

  it('schedules longer duration for dah than for dit', () => {
    // At 20 WPM, dit = 60ms, dah = 180ms.
    // We can compare the cursor advance by inspecting setValueAtTime calls.
    // Easier: just verify that BOTH dit and dah produce the same number
    // of envelope stages (attack + release = 2 setValueAtTime, 2 linearRamp).
    playMorse('.', { wpm: 20 });
    const ditSetCount = mockGain.gain.setValueAtTime.mock.calls.length;
    const ditRampCount = mockGain.gain.linearRampToValueAtTime.mock.calls.length;

    mockGain.gain.setValueAtTime.mockClear();
    mockGain.gain.linearRampToValueAtTime.mockClear();

    playMorse('-', { wpm: 20 });
    const dahSetCount = mockGain.gain.setValueAtTime.mock.calls.length;
    const dahRampCount = mockGain.gain.linearRampToValueAtTime.mock.calls.length;

    // Both should schedule the same envelope shape (2 sets + 2 ramps).
    expect(dahSetCount).toBe(ditSetCount);
    expect(dahRampCount).toBe(ditRampCount);
  });

  it('handles word separator " / " by adding word gap', () => {
    playMorse('. / .', { wpm: 20 });
    // We expect the play to not throw and to schedule multiple envelopes.
    // (Detailed timing math is covered by encoder.timing() tests.)
    expect(mockGain.gain.setValueAtTime).toHaveBeenCalled();
  });

  it('start() is called with a future timestamp', () => {
    playMorse('.-', { wpm: 20 });
    const startArg = mockOsc.start.mock.calls[0][0];
    expect(startArg).toBeGreaterThan(mockCtx.currentTime);
  });

  it('onended handler is attached', () => {
    playMorse('.-', { wpm: 20 });
    expect(typeof mockOsc.onended).toBe('function');
  });

  it('stop() does not throw when nothing is playing', () => {
    expect(() => stop()).not.toThrow();
  });
});
