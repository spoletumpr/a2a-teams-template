const INBOUND_MAX_BYTES = 16 * 1024;
const OUTBOUND_MAX_BYTES = 28 * 1024;

// Zero-width characters can make the visible Teams text differ from the text
// processed by kagent. Inbound text is rejected; outbound text is stripped.
const ZERO_WIDTH = /[\u200B\u200C\u200D\u2060\uFEFF]/u;
const ZERO_WIDTH_GLOBAL = /[\u200B\u200C\u200D\u2060\uFEFF]/gu;

// Preserve user formatting whitespace while removing non-printing controls that
// can confuse logs, Teams rendering, or downstream prompts/tools.
const CONTROL_CHARACTERS_EXCEPT_WHITESPACE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu;

// Teams renders <at> tags as mentions. Strip by default so agent output cannot
// notify users/channels unless the operator explicitly accepts that risk.
const OUTBOUND_MENTION_TAG = /<at>[^<>]*<\/at>/giu;

export type SanitiseResult =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly reason: string };

/**
 * Apply Teams boundary hygiene before forwarding text to kagent.
 * This deliberately does not attempt DLP, moderation, or prompt-injection
 * detection because those controls belong with the agent/platform policy.
 */
export function sanitiseInboundText(text: string): SanitiseResult {
  if (ZERO_WIDTH.test(text)) {
    return { ok: false, reason: 'Messages containing zero-width characters are not accepted.' };
  }

  // Normalize to NFC before byte-size enforcement so equivalent Unicode inputs
  // are handled consistently.
  const trimmed = text.replace(CONTROL_CHARACTERS_EXCEPT_WHITESPACE, '').normalize('NFC').trim();
  if (!trimmed) {
    return { ok: false, reason: 'Please send a text message.' };
  }

  if (Buffer.byteLength(trimmed, 'utf8') > INBOUND_MAX_BYTES) {
    return { ok: false, reason: 'Messages longer than 16KB are not accepted.' };
  }

  return { ok: true, text: trimmed };
}

/** Render agent output as bounded plain text and strip Teams mentions by default. */
export function sanitiseOutboundText(text: string, allowMentions: boolean): string {
  const cleaned = text.replace(ZERO_WIDTH_GLOBAL, '');
  const withoutMentions = allowMentions ? cleaned : stripOutboundMentions(cleaned).trim();

  // Cap output by UTF-8 bytes to stay below practical Teams payload limits while
  // preserving valid Unicode text.
  return capUtf8Bytes(withoutMentions, OUTBOUND_MAX_BYTES);
}

function stripOutboundMentions(text: string): string {
  let previous: string;
  let current = text;

  do {
    previous = current;
    current = current.replace(OUTBOUND_MENTION_TAG, '');
  } while (current !== previous);

  return current;
}

function capUtf8Bytes(text: string, maxBytes: number): string {
  if (Buffer.byteLength(text, 'utf8') <= maxBytes) {
    return text;
  }

  const ellipsis = '…';
  const targetBytes = maxBytes - Buffer.byteLength(ellipsis, 'utf8');
  let bytes = 0;
  let capped = '';

  // for..of iterates Unicode code points, avoiding broken surrogate pairs when
  // truncating text that contains emoji or other astral symbols.
  for (const char of text) {
    const charBytes = Buffer.byteLength(char, 'utf8');
    if (bytes + charBytes > targetBytes) {
      break;
    }
    capped += char;
    bytes += charBytes;
  }

  return `${capped.trimEnd()}${ellipsis}`;
}
