import { messages } from '@unbound-app/i18n';

// Each label is read when it is shown, so it follows the user's language.
export const PRONOUN_LABELS: Record<string, () => string> = {
	any: () => messages.PRONOUN_ANY,
	ask: () => messages.PRONOUN_ASK,
	avoid: () => messages.PRONOUN_AVOID,
	he: () => messages.PRONOUN_HE,
	it: () => messages.PRONOUN_IT,
	other: () => messages.PRONOUN_OTHER,
	she: () => messages.PRONOUN_SHE,
	they: () => messages.PRONOUN_THEY,
	unspecified: () => messages.PRONOUN_UNSPECIFIED,
};

// These labels are sentences, so they keep their capitals in the lowercase format.
export const SENTENCE_CODES = ['any', 'ask', 'avoid', 'other', 'unspecified'];

export const Lookup = {
	batchSize: 50,
	interval: 2000,
};
