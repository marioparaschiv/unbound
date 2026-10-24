export const PronounLabels: Record<string, string> = {
	any: 'Any pronouns',
	ask: 'Ask me my pronouns',
	avoid: 'Avoid pronouns, use my name',
	he: 'He/Him',
	it: 'It/Its',
	other: 'Other pronouns',
	she: 'She/Her',
	they: 'They/Them',
	unspecified: 'No pronouns specified.',
};

// These labels are sentences, so they keep their capitals in the lowercase format.
export const SENTENCE_CODES = ['any', 'ask', 'avoid', 'other', 'unspecified'];

export const Lookup = {
	batchSize: 50,
	interval: 2000,
};
