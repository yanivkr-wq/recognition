/**
 * @reco/shared — Reco shared package.
 *
 * Re-exports the locked design system, i18n dictionaries, and shared types.
 * Every consumer (web app, worker, future tools) imports from here so the
 * brandbook stays the single source of truth.
 */

export * as DesignTokens from './design-tokens/index';
export * as I18n from './i18n/index';
export * as Types from './types/index';
