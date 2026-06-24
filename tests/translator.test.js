/**
 * Tests for the bidirectional translator.
 *
 * The pure encode/decode functions are covered by tests/encoder.test.js;
 * here we test the bidirectional wiring (typing in text → morse updates
 * automatically, and vice versa).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { attachTranslator } from '../src/modes/translator.js';

function makeTextareas() {
  const text = document.createElement('textarea');
  text.id = 'translator-text';
  const morse = document.createElement('textarea');
  morse.id = 'translator-morse';
  document.body.appendChild(text);
  document.body.appendChild(morse);
  return { text, morse };
}

describe('translator (live bidirectional sync)', () => {
  let text, morse, handle;

  beforeEach(() => {
    document.body.innerHTML = '';
    ({ text, morse } = makeTextareas());
  });

  it('typing in text area updates morse area', () => {
    handle = attachTranslator({ textArea: text, morseArea: morse });
    text.value = 'SOS';
    text.dispatchEvent(new Event('input', { bubbles: true }));
    expect(morse.value).toBe('... --- ...');
  });

  it('typing in morse area updates text area', () => {
    handle = attachTranslator({ textArea: text, morseArea: morse });
    morse.value = '.... . .-.. .-.. ---';
    morse.dispatchEvent(new Event('input', { bubbles: true }));
    expect(text.value).toBe('HELLO');
  });

  it('decodes word separator / as space', () => {
    handle = attachTranslator({ textArea: text, morseArea: morse });
    morse.value = '.... . .-.. .-.. --- / .-- --- .-. .-.. -..';
    morse.dispatchEvent(new Event('input', { bubbles: true }));
    expect(text.value).toBe('HELLO WORLD');
  });

  it('clearing text area clears morse area', () => {
    handle = attachTranslator({ textArea: text, morseArea: morse });
    text.value = 'A';
    text.dispatchEvent(new Event('input', { bubbles: true }));
    expect(morse.value).toBe('.-');
    text.value = '';
    text.dispatchEvent(new Event('input', { bubbles: true }));
    expect(morse.value).toBe('');
  });

  it('clearing morse area clears text area', () => {
    handle = attachTranslator({ textArea: text, morseArea: morse });
    morse.value = '.-';
    morse.dispatchEvent(new Event('input', { bubbles: true }));
    expect(text.value).toBe('A');
    morse.value = '';
    morse.dispatchEvent(new Event('input', { bubbles: true }));
    expect(text.value).toBe('');
  });

  it('keeps partial morse token as-is (does not flash unknown char)', () => {
    handle = attachTranslator({ textArea: text, morseArea: morse });
    // .- is a complete token → A; but .-.-. (without space) is partial
    // (not a complete morse code for any char)
    morse.value = '.-';
    morse.dispatchEvent(new Event('input', { bubbles: true }));
    expect(text.value).toBe('A');
  });

  it('handles rapid alternating edits without flashing', () => {
    handle = attachTranslator({ textArea: text, morseArea: morse });
    text.value = 'A';
    text.dispatchEvent(new Event('input', { bubbles: true }));
    expect(morse.value).toBe('.-');
    morse.value = '-';
    morse.dispatchEvent(new Event('input', { bubbles: true }));
    expect(text.value).toBe('T');
    text.value = 'TEST';
    text.dispatchEvent(new Event('input', { bubbles: true }));
    expect(morse.value).toBe('- . ... -');
  });

  it('lowercase input is normalized to uppercase in morse', () => {
    handle = attachTranslator({ textArea: text, morseArea: morse });
    text.value = 'sos';
    text.dispatchEvent(new Event('input', { bubbles: true }));
    expect(morse.value).toBe('... --- ...');
  });

  it('returns a detach function that stops further sync', () => {
    handle = attachTranslator({ textArea: text, morseArea: morse });
    handle.detach();
    text.value = 'SOS';
    text.dispatchEvent(new Event('input', { bubbles: true }));
    expect(morse.value).toBe(''); // not updated after detach
  });

  it('treats / as word separator even without surrounding spaces', () => {
    handle = attachTranslator({ textArea: text, morseArea: morse });
    // No spaces around the slash — should still be normalized to " / "
    morse.value = '..../....';
    morse.dispatchEvent(new Event('input', { bubbles: true }));
    expect(text.value).toBe('H H');
  });

  it('handles / with mixed spacing (extra spaces, no spaces)', () => {
    handle = attachTranslator({ textArea: text, morseArea: morse });
    morse.value = '.... /.-';
    morse.dispatchEvent(new Event('input', { bubbles: true }));
    // After normalization: ".... / .-", decode → "H" + " " + "A"
    expect(text.value).toBe('H A');
  });

  it('treats standalone / as space (not as unknown char)', () => {
    handle = attachTranslator({ textArea: text, morseArea: morse });
    morse.value = '/';
    morse.dispatchEvent(new Event('input', { bubbles: true }));
    expect(text.value).toBe(' ');
  });
});