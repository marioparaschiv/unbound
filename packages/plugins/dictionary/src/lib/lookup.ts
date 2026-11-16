import { readFreeDictionary, readWiktionary, type Entry } from '~/lib/definitions';

const cache = new Map<string, Entry | null>();

async function fetchJson(url: string): Promise<unknown> {
	const response = await fetch(url, { headers: { Accept: 'application/json' } });

	return response.ok ? response.json() : undefined;
}

/**
 * @description Looks a word up: English through the Free Dictionary API, with pronunciation, then Wiktionary, which
 * covers other languages. Answers are kept for the session.
 * @param word The word.
 * @param language The reader's language code, which Wiktionary's results prefer.
 * @returns The entry, or `undefined` when neither source knows the word.
 */
export async function lookUp(word: string, language: string): Promise<Entry | undefined> {
	const key = `${language}:${word.toLowerCase()}`;

	if (cache.has(key)) return cache.get(key) ?? undefined;

	const encoded = encodeURIComponent(word);
	const english = await fetchJson(
		`https://api.dictionaryapi.dev/api/v2/entries/en/${encoded}`,
	).catch(() => undefined);
	const entry =
		readFreeDictionary(word, english) ??
		readWiktionary(
			word,
			await fetchJson(
				`https://en.wiktionary.org/api/rest_v1/page/definition/${encoded}`,
			).catch(() => undefined),
			language,
		);

	cache.set(key, entry ?? null);

	return entry;
}

export default { lookUp };
