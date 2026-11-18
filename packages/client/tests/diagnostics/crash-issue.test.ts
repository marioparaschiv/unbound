import { describe, expect, test } from 'bun:test';

import {
	crashIssueDraft,
	crashSearchTerm,
	crashSearchURL,
	isSearchResponse,
} from '~/diagnostics/crash-issue';

const record = {
	at: Date.UTC(2026, 10, 18, 12),
	kind: 'js',
	message: 'TypeError: Cannot read property "foo" of undefined\n    at render (bundle:1:2)',
	addon: 'unbound.example',
	reportId: 'r-1',
};

describe('crash issue', () => {
	test('searches for the first line without quotes', () => {
		expect(crashSearchTerm(record.message)).toBe(
			'TypeError: Cannot read property foo of undefined',
		);
	});

	test('caps the search term', () => {
		expect(crashSearchTerm('x'.repeat(200))).toHaveLength(80);
	});

	test('builds an open-issue search for the repository', () => {
		const url = new URL(crashSearchURL(record)!);
		const query = url.searchParams.get('q');

		expect(url.origin + url.pathname).toBe('https://api.github.com/search/issues');
		expect(query).toContain('is:issue is:open');
		expect(query).toContain('"TypeError: Cannot read property foo of undefined"');
	});

	test('gives no search for an empty message', () => {
		expect(crashSearchURL({ ...record, message: '  ' })).toBeUndefined();
	});

	test('accepts only a list of issues', () => {
		expect(isSearchResponse({ items: [{ number: 1, html_url: 'https://x' }] })).toBe(true);
		expect(isSearchResponse({ items: [{ number: '1' }] })).toBe(false);
		expect(isSearchResponse({ message: 'rate limited' })).toBe(false);
		expect(isSearchResponse(null)).toBe(false);
	});

	test('drafts a title naming the plugin and logs with the details', () => {
		const draft = crashIssueDraft(record, 'Example');

		expect(draft.title).toBe(
			'crash (Example): TypeError: Cannot read property "foo" of undefined',
		);
		expect(draft.logs).toContain('Kind: js');
		expect(draft.logs).toContain('When: 2026-11-18T12:00:00.000Z');
		expect(draft.logs).toContain('Plugin: unbound.example');
		expect(draft.logs).toContain('Report: r-1');
		expect(draft.logs.endsWith(record.message)).toBe(true);
	});

	test('drafts without a plugin', () => {
		expect(crashIssueDraft({ ...record, addon: undefined }, undefined).title).toMatch(
			/^crash: /,
		);
	});
});
