import { describe, expect, test } from 'bun:test';

import { needsRomanizing } from '~/lib/scripts';

describe('scripts', () => {
	test('offers romanizing for non-Latin letters', () => {
		for (const text of [
			'Привет',
			'Γειά',
			'مرحبا',
			'สวัสดี',
			'안녕',
			'こんにちは',
			'你好',
			'שלום',
		]) {
			expect(needsRomanizing(text)).toBe(true);
		}
	});

	test('skips Latin text, numbers and emoji', () => {
		expect(needsRomanizing('hello, café 123 🎉')).toBe(false);
	});
});
