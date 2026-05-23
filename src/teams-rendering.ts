import type { Message, Part, Task } from '@a2a-js/sdk';

import { sanitiseOutboundText } from './sanitise.js';

const EMPTY_TEXT_RESPONSE = 'The agent did not return a text response.';

/**
 * Render a kagent Agent A2A result into the Teams Connector Template's plain
 * text contract.
 *
 * This module owns Text-first Rendering for outbound Teams messages: A2A text
 * extraction, empty-text fallback, Configurable Mention Rendering, zero-width
 * stripping, and outbound size capping. It deliberately does not infer Adaptive
 * Cards from JSON or Markdown.
 */
export function renderTeamsResponse(result: Message | Task, allowMentions: boolean): string {
  const text = extractText(result) || EMPTY_TEXT_RESPONSE;
  return sanitiseOutboundText(text, allowMentions);
}

/** Convert A2A message/task responses into the connector's plain-text contract. */
export function extractText(result: Message | Task): string {
  if (result.kind === 'message') {
    return partsToText(result.parts);
  }

  const statusText = result.status.message ? partsToText(result.status.message.parts) : '';
  const artifactText = result.artifacts?.flatMap((artifact) => artifact.parts).map(partToText).filter(Boolean).join('\n') ?? '';
  return [statusText, artifactText].filter(Boolean).join('\n').trim();
}

function partsToText(parts: readonly Part[]): string {
  // Preserve readable separation between text parts without interpreting the
  // content as Markdown, JSON, or Adaptive Cards.
  return parts.map(partToText).filter(Boolean).join('\n').trim();
}

function partToText(part: Part): string {
  // The v1 connector is text-first. Non-text A2A parts are ignored unless a
  // future explicit contract defines safe Teams rendering, such as cards.
  if (part.kind === 'text') {
    return part.text;
  }
  return '';
}
