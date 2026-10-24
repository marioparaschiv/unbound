import { getLanguageMetadata, resolveCatalogLanguage } from '~/catalog';
import { LANGUAGE_ALIASES, LANGUAGE_LABELS } from '~/constants';
import { highlightLanguageLabel } from '~/highlight-js';

/**
 * @description Resolves a fence's language tag to a Shiki language name, case-insensitively.
 * @param tag The text after the opening fence.
 * @returns The Shiki language, or `null` when no grammar is known for it.
 */
export function resolveLanguage(tag: string): string | null {
	const name = tag.trim().toLowerCase();

	return LANGUAGE_ALIASES[name] ?? resolveCatalogLanguage(name);
}

/**
 * @description Names a language for the card header, preferring the catalog's display name.
 * @param language The Shiki or Highlight.js language.
 * @returns A human-readable name, or the language itself when nothing better is known.
 */
export function languageLabel(language: string): string {
	return (
		getLanguageMetadata(language)?.displayName ??
		LANGUAGE_LABELS[language] ??
		highlightLanguageLabel(language) ??
		language
	);
}

export default { resolveLanguage, languageLabel };
