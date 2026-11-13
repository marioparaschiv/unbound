type Autocompletion = { text: string };

type AutocompleteOptions = { query: string; maxResults: number };

export type SearchRule = {
	regex: RegExp;
	componentType: 'FILTER' | 'ANSWER';
	key?: string;
	plainText?: string;
	follows?: string[];
	queryKey?: string;
	getAutocompletions?: (options: AutocompleteOptions) => Autocompletion[];
};

type FilterSpec = { name: string; key: string; answer: RegExp; values?: string[] };

const BOOLEAN = /^\s*(true|false)/i;
const WORD = /^\s*[^\s]+/;
const SLOP = /^\s*(?:[0-9]|[1-9][0-9]|100)\b/;
const ID = /^\s*\d{17,20}\b/;
const BOOLEAN_VALUES = ['true', 'false'];

const FILTERS: FilterSpec[] = [
	{ name: 'INCLUDE_NSFW', key: 'includeNsfw', answer: BOOLEAN, values: BOOLEAN_VALUES },
	{ name: 'REPLIED_TO_MESSAGE_ID', key: 'repliedToMessageId', answer: ID },
	{ name: 'REPLIED_TO_USER_ID', key: 'repliedToUserId', answer: ID },
	{ name: 'MENTIONS_ROLE_ID', key: 'mentionsRoleId', answer: ID },
	{ name: 'MENTION_EVERYONE', key: 'mentionEveryone', answer: BOOLEAN, values: BOOLEAN_VALUES },
	{
		name: 'EMBED_TYPE',
		key: 'embedType',
		answer: WORD,
		values: ['image', 'video', 'gif', 'sound', 'article'],
	},
	{ name: 'EMBED_PROVIDER', key: 'embedProvider', answer: WORD },
	{ name: 'COMMAND_ID', key: 'commandId', answer: ID },
	{ name: 'COMMAND_NAME', key: 'commandName', answer: WORD },
	{ name: 'SLOP', key: 'slop', answer: SLOP },
];

const snakeCase = (key: string) => key.replace(/([A-Z])/g, '_$1').toLowerCase();

function completions(values: string[] = []) {
	return ({ query, maxResults }: AutocompleteOptions): Autocompletion[] =>
		values
			.filter((value) => value.startsWith(query.toLowerCase()))
			.slice(0, maxResults)
			.map((text) => ({ text }));
}

/**
 * @description Builds the search filters Discord's API takes but its search box does not offer, as rules for its tokenizer,
 * the same filters Vencord's BetterSearch adds.
 * @returns The rules by token type, a `FILTER_` rule for each `key:` and an `ANSWER_` rule for its value.
 */
export function searchRules(): Record<string, SearchRule> {
	return Object.fromEntries(
		FILTERS.flatMap(({ name, key, answer, values }) => [
			[
				`FILTER_${name}`,
				{
					regex: new RegExp(`^${key}:`, 'i'),
					componentType: 'FILTER',
					key: `${key}:`,
					plainText: key,
					getAutocompletions: completions(values),
				},
			],
			[
				`ANSWER_${name}`,
				{
					regex: answer,
					follows: [`FILTER_${name}`],
					componentType: 'ANSWER',
					queryKey: snakeCase(key),
				},
			],
		]),
	);
}
