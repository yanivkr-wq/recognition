/**
 * Server actions wrapping the LLM autofill module.
 *
 * Admin-gated — only parents trigger LLM calls. Returns a discriminated
 * union so the calling client component can branch on success vs. error
 * without parsing error strings.
 *
 * Per-form variants (suggestTaskFields / suggestRewardFields) instead of
 * one polymorphic action: keeps the family literal type-safe and the
 * form-side code free of casting.
 */

'use server';

import 'server-only';
import { requireAdmin, UnauthorizedError } from '../auth/guards';
import { suggestFields, type SuggestResult } from './suggest-fields';

export type SuggestFieldsState =
  | { ok: true; data: SuggestResult }
  | { ok: false; error: 'forbidden' | 'missing_title' | 'llm_failed' };

async function run(
  family: 'task' | 'reward',
  formData: FormData,
): Promise<SuggestFieldsState> {
  const titleHe = String(formData.get('titleHe') ?? '').trim();
  const descriptionHe = String(formData.get('descriptionHe') ?? '').trim() || undefined;
  if (!titleHe) return { ok: false, error: 'missing_title' };

  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) return { ok: false, error: 'forbidden' };
    throw err;
  }

  try {
    const data = await suggestFields({ family, titleHe, descriptionHe });
    return { ok: true, data };
  } catch (err) {
    console.error(`suggestFields (${family}) failed`, err);
    return { ok: false, error: 'llm_failed' };
  }
}

export async function suggestTaskFieldsAction(
  _prev: SuggestFieldsState | undefined,
  formData: FormData,
): Promise<SuggestFieldsState> {
  return run('task', formData);
}

export async function suggestRewardFieldsAction(
  _prev: SuggestFieldsState | undefined,
  formData: FormData,
): Promise<SuggestFieldsState> {
  return run('reward', formData);
}
