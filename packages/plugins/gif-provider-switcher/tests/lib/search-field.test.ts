import { describe, expect, test } from 'bun:test';

import {
	currentQuery,
	findSearchField,
	readQuery,
	renameProvider,
	renameSearchField,
	toggleLeadingSpace,
	type ElementNode,
} from '~/lib/search-field';

function clone(element: ElementNode, props: Record<string, unknown>) {
	return { ...element, props: { ...element.props, ...props } };
}

function header(placeholder: string, value = '') {
	return {
		type: 'View',
		props: {
			children: [
				{ type: 'Icon', props: {} },
				{
					type: 'SearchField',
					props: { placeholder, accessibilityLabel: placeholder, value },
				},
			],
		},
	};
}

describe('renameProvider', () => {
	test('replaces Klipy in any case', () => {
		expect(renameProvider('Search Klipy', 'Tenor')).toBe('Search Tenor');
		expect(renameProvider('Search KLIPY', 'Giphy')).toBe('Search Giphy');
		expect(renameProvider('Search GIFs', 'Tenor')).toBe('Search GIFs');
	});
});

describe('toggleLeadingSpace', () => {
	test('adds or removes one leading space', () => {
		expect(toggleLeadingSpace('cat')).toBe(' cat');
		expect(toggleLeadingSpace(' cat')).toBe('cat');
	});
});

describe('search field', () => {
	test('finds the field and reads its query', () => {
		const field = findSearchField(header('Search Klipy', 'cat'));

		expect(field?.type).toBe('SearchField');
		expect(readQuery(field!)).toBe('cat');
		expect(readQuery({ props: { defaultValue: 'dog' } })).toBe('dog');
		expect(readQuery({})).toBe('');
		expect(findSearchField({ type: 'View', props: { children: 'text' } })).toBeUndefined();
	});

	test('renames the placeholder and label without changing the original', () => {
		const original = header('Search Klipy');
		const renamed = renameSearchField(original, 'Tenor', clone) as ReturnType<typeof header>;
		const field = renamed.props.children[1]!;

		expect(field.props).toMatchObject({
			placeholder: 'Search Tenor',
			accessibilityLabel: 'Search Tenor',
		});
		expect(renamed.props.children[0]).toBe(original.props.children[0]);
		expect(original.props.children[1]!.props.placeholder).toBe('Search Klipy');
	});

	test('returns the same tree when nothing names Klipy', () => {
		const original = header('Search GIFs');

		expect(renameSearchField(original, 'Tenor', clone)).toBe(original);
	});
});

describe('currentQuery', () => {
	test('prefers the GIF picker store query', () => {
		expect(currentQuery('cat', '')).toBe('cat');
		expect(currentQuery(' cat', 'dog')).toBe(' cat');
	});

	test('falls back to the search field when the store has no query', () => {
		expect(currentQuery(undefined, 'dog')).toBe('dog');
		expect(currentQuery('', 'dog')).toBe('dog');
		expect(currentQuery('  ', 'dog')).toBe('dog');
		expect(currentQuery(42, '')).toBe('');
	});
});
