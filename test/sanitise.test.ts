import { describe, expect, it } from 'vitest';

import {
  sanitiseInboundText,
  sanitiseOutboundText,
} from '../src/sanitise.js';

describe('sanitiseInboundText', () => {
  it('trims accepted text', () => {
    expect(sanitiseInboundText(' hello ')).toEqual({ ok: true, text: 'hello' });
  });

  it('normalizes text to NFC', () => {
    expect(sanitiseInboundText(' cafe\u0301 ')).toEqual({ ok: true, text: 'café' });
  });

  it('strips control characters except newline, carriage return, and tab', () => {
    expect(sanitiseInboundText('he\u0000llo\nthere\tfriend\r')).toEqual({
      ok: true,
      text: 'hello\nthere\tfriend',
    });
  });

  it('rejects empty text', () => {
    expect(sanitiseInboundText('   ')).toEqual({ ok: false, reason: 'Please send a text message.' });
  });

  it('rejects zero-width characters', () => {
    expect(sanitiseInboundText('hel\u200Blo')).toEqual({
      ok: false,
      reason: 'Messages containing zero-width characters are not accepted.',
    });
  });

  it('rejects text over 16KB', () => {
    expect(sanitiseInboundText('a'.repeat(16 * 1024 + 1))).toEqual({
      ok: false,
      reason: 'Messages longer than 16KB are not accepted.',
    });
  });
});

describe('sanitiseOutboundText', () => {
  it('strips mention tags by default', () => {
    expect(sanitiseOutboundText('Hi <at>Alice</at>', false)).toBe('Hi');
  });

  it('strips nested mention tags by default', () => {
    expect(sanitiseOutboundText('Hi <at>Alice <at>Bob</at></at>', false)).toBe('Hi');
  });

  it('allows mention tags when explicitly enabled', () => {
    expect(sanitiseOutboundText('Hi <at>Alice</at>', true)).toBe('Hi <at>Alice</at>');
  });

  it('removes zero-width characters', () => {
    expect(sanitiseOutboundText('hel\u200Blo', false)).toBe('hello');
  });

  it('caps outbound text at 28KB', () => {
    const result = sanitiseOutboundText('a'.repeat(28 * 1024 + 1), false);

    expect(Buffer.byteLength(result, 'utf8')).toBeLessThanOrEqual(28 * 1024);
    expect(result.endsWith('…')).toBe(true);
  });
});

