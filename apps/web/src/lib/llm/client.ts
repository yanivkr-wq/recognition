/**
 * Singleton Anthropic SDK client.
 *
 * Reads ANTHROPIC_API_KEY from process.env at first call. The SDK validates
 * + throws on missing key, so we don't pre-check — the error message it
 * produces is more informative than a generic guard.
 *
 * Single import path means we don't accidentally spin up multiple HTTP
 * agents across server actions.
 */

import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

let _client: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (!_client) {
    _client = new Anthropic();
  }
  return _client;
}
