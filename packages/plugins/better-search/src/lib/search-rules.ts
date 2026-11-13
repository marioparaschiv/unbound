import { metro } from '@unbound-app/api';

import { searchRules } from '~/lib/filters';

type Tokenizer = { refreshSearchTokens?: () => void; clearTokenCache?: () => void };

const added = searchRules();

function rulesAndTokenizer() {
	const rules: Record<string, unknown> | undefined = metro.findByProps(
		'FILTER_FROM',
		'ANSWER_USERNAME_FROM',
		{
			lazy: false,
		},
	);
	const tokenizer: Tokenizer | undefined = metro.findByProps(
		'tokenizeQuery',
		'getSearchQueryFromTokens',
	);

	return { rules, tokenizer };
}

function reloadTokens(tokenizer: Tokenizer | undefined): void {
	tokenizer?.refreshSearchTokens?.();
	tokenizer?.clearTokenCache?.();
}

/**
 * @description Teaches Discord's search box the extra filters, by adding rules to its search token rules and rebuilding its
 * tokenizer. Discord's query builder already sends any rule's `queryKey` with the value typed.
 */
export function addSearchFilters(): void {
	const { rules, tokenizer } = rulesAndTokenizer();

	if (!rules) {
		logger.warn('Search filters skipped: Discord moved its search token rules.');

		return;
	}

	Object.assign(rules, added);
	reloadTokens(tokenizer);
}

/**
 * @description Takes the extra filters back out of Discord's search box.
 */
export function removeSearchFilters(): void {
	const { rules, tokenizer } = rulesAndTokenizer();

	if (!rules) return;

	for (const type of Object.keys(added)) delete rules[type];

	reloadTokens(tokenizer);
}
