import { describe, expect, test } from 'bun:test';

import { DEFAULT_RULES } from './constants';
import { cleanUrls, compileRules } from './clean-urls';

const rules = compileRules(DEFAULT_RULES);

describe('cleanUrls', () => {
	test('removes tracking parameters and keeps the rest', () => {
		expect(cleanUrls('see https://example.com/a?utm_source=x&id=7&fbclid=y', rules)).toBe(
			'see https://example.com/a?id=7',
		);
	});

	test('applies host rules only on their host', () => {
		expect(cleanUrls('https://youtu.be/abc?si=123&t=4', rules)).toBe(
			'https://youtu.be/abc?t=4',
		);
		expect(cleanUrls('https://example.com/?si=123', rules)).toBe('https://example.com/?si=123');
	});

	test('matches wildcard parameters and wildcard hosts', () => {
		expect(cleanUrls('https://www.amazon.de/dp/1?pd_rd_w=a&th=1', rules)).toBe(
			'https://www.amazon.de/dp/1?th=1',
		);
		expect(cleanUrls('https://www.amazon.de/dp/1?pd_rd_w=a&pd_rd_r=b&th=1', rules)).toBe(
			'https://www.amazon.de/dp/1?th=1',
		);
		expect(cleanUrls('https://x.com/?pk_a=1&pk_b=2&id=3', rules)).toBe('https://x.com/?id=3');
		expect(cleanUrls('https://mobile.twitter.com/u?s=20', rules)).toBe(
			'https://mobile.twitter.com/u',
		);
	});

	test('leaves links without a query and surrounding punctuation untouched', () => {
		expect(cleanUrls('(https://Example.com/Path).', rules)).toBe('(https://Example.com/Path).');
		expect(cleanUrls('no links here', rules)).toBe('no links here');
	});
});
