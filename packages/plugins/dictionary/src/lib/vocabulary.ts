import { storage } from '@unbound-app/api';

export type SavedWord = { word: string; gloss: string; savedAt: number };

const KEY = 'vocabulary';

const bucket = storage.getBucket();

function isSavedWord(value: unknown): value is SavedWord {
	const entry = value as Partial<SavedWord> | null;

	return (
		typeof entry?.word === 'string' &&
		typeof entry.gloss === 'string' &&
		typeof entry.savedAt === 'number'
	);
}

/**
 * @description Reads the saved words.
 * @returns The words, newest first.
 */
export function getVocabulary(): SavedWord[] {
	const value: unknown = bucket.get(KEY, []);

	return Array.isArray(value)
		? value.filter(isSavedWord).sort((a, b) => b.savedAt - a.savedAt)
		: [];
}

/**
 * @description Saves a word with a short gloss, or removes it when it is already saved.
 * @param word The word.
 * @param gloss Its first definition.
 * @returns Whether the word is saved now.
 */
export function toggleWord(word: string, gloss: string): boolean {
	const list = getVocabulary();
	const saved = list.some((entry) => entry.word === word);

	bucket.set(
		KEY,
		saved
			? list.filter((entry) => entry.word !== word)
			: [{ word, gloss, savedAt: Date.now() }, ...list],
	);

	return !saved;
}

/**
 * @description Reads the saved words and re-renders the component when they change.
 * @returns The words, newest first.
 */
export function useVocabulary(): SavedWord[] {
	storage.useBucket(addon.id);

	return getVocabulary();
}

export default { getVocabulary, toggleWord, useVocabulary };
