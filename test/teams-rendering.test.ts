import type { Message, Task } from '@a2a-js/sdk';
import { describe, expect, it } from 'vitest';

import { extractText, renderTeamsResponse } from '../src/teams-rendering.js';

describe('extractText', () => {
  it('extracts text from message parts', () => {
    const message = {
      kind: 'message',
      parts: [
        { kind: 'text', text: 'hello' },
        { kind: 'text', text: 'there' },
      ],
    } as Message;

    expect(extractText(message)).toBe('hello\nthere');
  });

  it('trims message text and ignores non-text parts', () => {
    const message = {
      kind: 'message',
      parts: [
        { kind: 'text', text: ' hello ' },
        { kind: 'data', data: { ignored: true } },
      ],
    } as unknown as Message;

    expect(extractText(message)).toBe('hello');
  });

  it('extracts text from task status messages', () => {
    const task = {
      kind: 'task',
      status: {
        message: {
          kind: 'message',
          parts: [{ kind: 'text', text: 'status text' }],
        },
      },
    } as Task;

    expect(extractText(task)).toBe('status text');
  });

  it('extracts text from task artifacts', () => {
    const task = {
      kind: 'task',
      status: {},
      artifacts: [
        { parts: [{ kind: 'text', text: 'artifact one' }] },
        { parts: [{ kind: 'text', text: 'artifact two' }] },
      ],
    } as Task;

    expect(extractText(task)).toBe('artifact one\nartifact two');
  });

  it('joins task status and artifact text', () => {
    const task = {
      kind: 'task',
      status: {
        message: {
          kind: 'message',
          parts: [{ kind: 'text', text: 'status' }],
        },
      },
      artifacts: [{ parts: [{ kind: 'text', text: 'artifact' }] }],
    } as Task;

    expect(extractText(task)).toBe('status\nartifact');
  });

  it('returns empty text for tasks without text parts', () => {
    const task = {
      kind: 'task',
      status: {},
      artifacts: [{ parts: [{ kind: 'file', file: { name: 'report.pdf' } }] }],
    } as unknown as Task;

    expect(extractText(task)).toBe('');
  });
});

describe('renderTeamsResponse', () => {
  it('renders a safe fallback when the agent has no text response', () => {
    const message = {
      kind: 'message',
      parts: [{ kind: 'data', data: { ignored: true } }],
    } as unknown as Message;

    expect(renderTeamsResponse(message, false)).toBe('The agent did not return a text response.');
  });

  it('strips outbound Teams mention tags by default', () => {
    const message = {
      kind: 'message',
      parts: [{ kind: 'text', text: 'Hi <at>Alice</at>' }],
    } as Message;

    expect(renderTeamsResponse(message, false)).toBe('Hi');
  });

  it('allows outbound Teams mention tags when configured', () => {
    const message = {
      kind: 'message',
      parts: [{ kind: 'text', text: 'Hi <at>Alice</at>' }],
    } as Message;

    expect(renderTeamsResponse(message, true)).toBe('Hi <at>Alice</at>');
  });

  it('removes zero-width characters and caps outbound text', () => {
    const message = {
      kind: 'message',
      parts: [{ kind: 'text', text: `hel\u200Blo ${'a'.repeat(28 * 1024)}` }],
    } as Message;

    const result = renderTeamsResponse(message, false);

    expect(result.startsWith('hello')).toBe(true);
    expect(Buffer.byteLength(result, 'utf8')).toBeLessThanOrEqual(28 * 1024);
    expect(result.endsWith('…')).toBe(true);
  });
});
