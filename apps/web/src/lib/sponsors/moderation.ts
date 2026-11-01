import { englishDataset, englishRecommendedTransformers, RegExpMatcher } from 'obscenity';

const profanity = new RegExpMatcher({
	...englishDataset.build(),
	...englishRecommendedTransformers,
});

const RESERVED_WORDS = new Set([
	'staff',
	'admin',
	'administrator',
	'mod',
	'moderator',
	'team',
	'support',
	'official',
	'unbound',
	'discord',
	'verified',
]);

const RESERVED_SUBSTRINGS = ['unbound', 'discord', 'moderator', 'official'];

function normalize(label: string): string {
	return label.normalize('NFKD').replaceAll(/\p{M}/gu, '').toLowerCase();
}

// Spelled-out runs such as "S t a f f" or "f.u.c.k" join back into one word.
function wordsJoiningSpelledLetters(label: string): string[] {
	const result: string[] = [];
	let letters = '';

	for (const token of normalize(label).split(/[^a-z0-9]+/)) {
		if (token.length === 1) {
			letters += token;

			continue;
		}

		if (letters) {
			result.push(letters);
			letters = '';
		}

		if (token) {
			result.push(token);
		}
	}

	if (letters) {
		result.push(letters);
	}

	return result;
}

function isReserved(word: string): boolean {
	return (
		RESERVED_WORDS.has(word) || (word.endsWith('s') && RESERVED_WORDS.has(word.slice(0, -1)))
	);
}

/**
 * @description Checks a badge name that already passed the contract schema for profanity and for
 * words that would impersonate staff, ignoring case, accents, spacing and punctuation.
 * @param name The badge name.
 * @returns Why the name is refused, or `undefined` when it is fine.
 */
export function findBadgeNameProblem(name: string): string | undefined {
	const nameWords = wordsJoiningSpelledLetters(name);

	if (profanity.hasMatch(name) || profanity.hasMatch(nameWords.join(' '))) {
		return 'The badge name contains a word that is not allowed.';
	}

	const compacted = nameWords.join('');
	const reserved =
		nameWords.find(isReserved) ?? RESERVED_SUBSTRINGS.find((word) => compacted.includes(word));

	if (reserved) {
		return `Badge names cannot contain "${reserved}".`;
	}
}

export default { findBadgeNameProblem };
