export type Sense = { definition: string; example?: string };

export type Meaning = { partOfSpeech: string; senses: Sense[] };

export type Entry = {
	word: string;
	phonetic?: string;
	audio?: string;
	meanings: Meaning[];
	source: string;
};

type ApiPhonetic = { text?: string; audio?: string };

type ApiDefinition = { definition?: string; example?: string };

type ApiMeaning = { partOfSpeech?: string; definitions?: ApiDefinition[] };

type ApiEntry = {
	word?: string;
	phonetic?: string;
	phonetics?: ApiPhonetic[];
	meanings?: ApiMeaning[];
};

type WiktionarySense = { definition?: string; examples?: string[] };

type WiktionaryUsage = { partOfSpeech?: string; definitions?: WiktionarySense[] };

const SENSES_PER_MEANING = 3;

function stripMarkup(html: string): string {
	return html
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * @description Reads Free Dictionary API's answer for a word into one entry, merging its homographs.
 * @param word The word looked up.
 * @param body The API's JSON.
 * @returns The entry, or `undefined` when the answer holds no definitions.
 */
export function readFreeDictionary(word: string, body: unknown): Entry | undefined {
	const entries = Array.isArray(body) ? (body as ApiEntry[]) : [];
	const phonetics = entries.flatMap((entry) => entry.phonetics ?? []);
	const meanings = entries.flatMap((entry) =>
		(entry.meanings ?? []).map((meaning) => ({
			partOfSpeech: meaning.partOfSpeech ?? '',
			senses: (meaning.definitions ?? [])
				.filter((sense) => sense.definition)
				.slice(0, SENSES_PER_MEANING)
				.map((sense) => ({
					definition: sense.definition!,
					...(sense.example ? { example: sense.example } : {}),
				})),
		})),
	);
	const kept = meanings.filter((meaning) => meaning.senses.length > 0);

	if (kept.length === 0) return undefined;

	const phonetic =
		entries.find((entry) => entry.phonetic)?.phonetic ?? phonetics.find((p) => p.text)?.text;
	const audio = phonetics.find((p) => p.audio)?.audio;

	return {
		word: entries[0]?.word ?? word,
		...(phonetic ? { phonetic } : {}),
		...(audio ? { audio } : {}),
		meanings: kept,
		source: 'Free Dictionary API',
	};
}

/**
 * @description Reads Wiktionary's definitions for a word, in the given language when it has them, else the first it lists.
 * @param word The word looked up.
 * @param body Wiktionary's JSON, keyed by language code.
 * @param language The language to prefer, such as `de`.
 * @returns The entry, or `undefined` when Wiktionary has no definitions.
 */
export function readWiktionary(word: string, body: unknown, language: string): Entry | undefined {
	const languages = (body && typeof body === 'object' ? body : {}) as Record<
		string,
		WiktionaryUsage[]
	>;
	const usages = languages[language] ?? Object.values(languages).find(Array.isArray) ?? [];
	const meanings = usages
		.map((usage) => ({
			partOfSpeech: usage.partOfSpeech ?? '',
			senses: (usage.definitions ?? [])
				.map((sense) => ({
					definition: stripMarkup(sense.definition ?? ''),
					example: sense.examples?.[0] ? stripMarkup(sense.examples[0]) : undefined,
				}))
				.filter((sense) => sense.definition)
				.slice(0, SENSES_PER_MEANING)
				.map(({ definition, example }) =>
					example ? { definition, example } : { definition },
				),
		}))
		.filter((meaning) => meaning.senses.length > 0);

	return meanings.length ? { word, meanings, source: 'Wiktionary' } : undefined;
}

export default { readFreeDictionary, readWiktionary };
