import { expect, test } from 'bun:test';

import { getErrorMessage } from './errors';

test('prefers the API message, then the error message, then the response text', () => {
	expect(getErrorMessage(new Error('boom'))).toBe('boom');
	expect(getErrorMessage({ body: { message: 'Maximum stickers reached' } })).toBe(
		'Maximum stickers reached',
	);
	expect(getErrorMessage({ message: 'offline' })).toBe('offline');
	expect(getErrorMessage({ text: 'Bad Gateway' })).toBe('Bad Gateway');
});

test('falls back to a generic sentence', () => {
	expect(getErrorMessage({ body: {} })).toBe('The operation could not be completed.');
	expect(getErrorMessage(null)).toBe('The operation could not be completed.');
});
