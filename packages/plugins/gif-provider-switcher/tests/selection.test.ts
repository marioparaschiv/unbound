import { describe, expect, test } from 'bun:test';

import { isReplacement, nextProvider, providerLabel } from '~/providers/selection';

describe('provider selection', () => {
	test('only Tenor and Giphy replace Discord', () => {
		expect(isReplacement('tenor')).toBe(true);
		expect(isReplacement('giphy')).toBe(true);
		expect(isReplacement('klipy')).toBe(false);
	});

	test('cycles Tenor, Giphy, Klipy', () => {
		expect(nextProvider('tenor')).toBe('giphy');
		expect(nextProvider('giphy')).toBe('klipy');
		expect(nextProvider('klipy')).toBe('tenor');
	});

	test('names each provider', () => {
		expect(providerLabel('tenor')).toBe('Tenor');
		expect(providerLabel('giphy')).toBe('Giphy');
		expect(providerLabel('klipy')).toBe('Klipy');
	});
});
