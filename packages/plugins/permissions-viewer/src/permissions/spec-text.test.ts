import { expect, test } from 'bun:test';

import { resolveSpecText } from '~/permissions/spec-text';

const format = (message: unknown) => (typeof message === 'function' ? 'formatted' : undefined);

test('keeps plain text and formats localised messages', () => {
	expect(resolveSpecText('Manage Server', format)).toBe('Manage Server');
	expect(resolveSpecText(() => 'x', format)).toBe('formatted');
});

test('returns nothing for empty, missing or unformattable values', () => {
	expect(resolveSpecText('', format)).toBeUndefined();
	expect(resolveSpecText(undefined, format)).toBeUndefined();
	expect(resolveSpecText(42, format)).toBeUndefined();
	expect(resolveSpecText({}, format)).toBeUndefined();
});
