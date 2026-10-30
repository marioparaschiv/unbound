import { expect, test } from 'bun:test';

import { get, on, remove, set, settings } from './storage';

test('removes keys whose value is falsy', () => {
	const removed: string[] = [];

	on('removed', ({ key }) => removed.push(key));

	set('storage-test', 'enabled', false);
	set('storage-test', 'count', 0);
	set('storage-test', 'label', '');
	set('storage-test', 'kept', true);

	remove('storage-test', 'enabled');
	remove('storage-test', 'count');
	remove('storage-test', 'label');

	expect(removed).toEqual(['enabled', 'count', 'label']);
	expect(get('storage-test', 'enabled', 'missing')).toBe('missing');
	expect(settings['storage-test']).toEqual({ kept: true });
});

test('ignores a key in a store that does not exist', () => {
	expect(() => remove('storage-test-missing', 'key')).not.toThrow();
});
