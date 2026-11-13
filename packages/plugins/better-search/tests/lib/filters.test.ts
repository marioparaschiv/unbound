import { describe, expect, test } from 'bun:test';

import { searchRules } from '~/lib/filters';

describe('search filters', () => {
	const rules = searchRules();

	test('pairs each filter with an answer that sends its snake_case query key', () => {
		expect(rules.FILTER_EMBED_TYPE?.regex.test('embedType:')).toBe(true);
		expect(rules.ANSWER_EMBED_TYPE).toMatchObject({
			follows: ['FILTER_EMBED_TYPE'],
			componentType: 'ANSWER',
			queryKey: 'embed_type',
		});
		expect(rules.ANSWER_REPLIED_TO_USER_ID?.queryKey).toBe('replied_to_user_id');
	});

	test('accepts only the values each filter takes', () => {
		expect(rules.ANSWER_INCLUDE_NSFW?.regex.test(' true')).toBe(true);
		expect(rules.ANSWER_REPLIED_TO_USER_ID?.regex.test(' 1234')).toBe(false);
		expect(rules.ANSWER_SLOP?.regex.test(' 50')).toBe(true);
	});

	test('suggests the values it knows', () => {
		expect(
			rules.FILTER_EMBED_TYPE?.getAutocompletions?.({ query: 'g', maxResults: 5 }),
		).toEqual([{ text: 'gif' }]);
	});
});
