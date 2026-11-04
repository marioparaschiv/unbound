import { languageNames } from '@shikijs/langs';

import { LANGUAGE_CATALOG_URL, SHIKI_ASSET_COMMIT } from '~/constants';

export type LanguageMetadata = {
	aliases?: string[];
	devicon?: string;
	displayName: string;
	name: string;
	scopeName: string;
};

const knownLanguages = new Set<string>(languageNames);
const languages = new Map<string, LanguageMetadata>();
const aliases = new Map<string, string>();

let catalogPromise: Promise<void> | null = null;

/**
 * @description Builds the CDN URL of a TextMate grammar Shiki does not bundle.
 * @param name The grammar's language name.
 * @returns The grammar JSON URL, pinned to one asset commit.
 */
export function grammarUrl(name: string): string {
	return `https://cdn.jsdelivr.net/gh/shikijs/textmate-grammars-themes@${SHIKI_ASSET_COMMIT}/packages/tm-grammars/grammars/${encodeURIComponent(name)}.json`;
}

/**
 * @description Resolves a fence language through Shiki's language names and the remote catalog's aliases.
 * @param name The fence language, trimmed and lowercased.
 * @returns The language name, or `null` when neither Shiki nor the catalog knows it.
 */
export function resolveCatalogLanguage(name: string): string | null {
	if (!name) return null;

	return aliases.get(name) ?? (knownLanguages.has(name) ? name : null);
}

/**
 * @description Looks up a language in the loaded catalog.
 * @param name The language name.
 * @returns Its display name, scope and icon, or `undefined` before the catalog loads.
 */
export function getLanguageMetadata(name: string): LanguageMetadata | undefined {
	return languages.get(name);
}

/**
 * @description Fetches the language catalog once; a failed fetch is retried on the next call.
 * @returns A promise that settles when the catalog is loaded.
 */
export function loadLanguageCatalog(): Promise<void> {
	catalogPromise ??= fetch(LANGUAGE_CATALOG_URL)
		.then((response) => {
			if (!response.ok) {
				throw new Error(`Language catalog returned ${response.status}`);
			}

			return response.json() as Promise<LanguageMetadata[]>;
		})
		.then((entries) => {
			for (const entry of entries) {
				if (!entry.name || !entry.scopeName) {
					continue;
				}

				knownLanguages.add(entry.name);
				languages.set(entry.name, entry);

				for (const alias of entry.aliases ?? []) aliases.set(alias, entry.name);
			}
		})
		.catch((error) => {
			catalogPromise = null;
			throw error;
		});

	return catalogPromise;
}

export default { grammarUrl, resolveCatalogLanguage, getLanguageMetadata, loadLanguageCatalog };
