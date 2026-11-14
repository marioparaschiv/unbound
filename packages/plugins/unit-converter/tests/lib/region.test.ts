import { expect, test } from 'bun:test';

import { systemForLocale } from '~/lib/region';

test('reads imperial regions from the locale', () => {
	expect(systemForLocale('en-US')).toBe('imperial');
	expect(systemForLocale('my_MM')).toBe('imperial');
	expect(systemForLocale('en-GB')).toBe('metric');
	expect(systemForLocale('de')).toBe('metric');
	expect(systemForLocale(undefined)).toBe('metric');
});
