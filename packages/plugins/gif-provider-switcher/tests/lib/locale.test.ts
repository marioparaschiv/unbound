import { describe, expect, test } from 'bun:test';

import { toGiphyLanguage, toTenorLocale } from '~/lib/locale';

describe('toTenorLocale', () => {
	test('uses an underscore and lowercase', () => {
		expect(toTenorLocale('en-US')).toBe('en_us');
		expect(toTenorLocale('pt-BR')).toBe('pt_br');
		expect(toTenorLocale('fr')).toBe('fr');
	});
});

describe('toGiphyLanguage', () => {
	test('keeps only the language for most locales', () => {
		expect(toGiphyLanguage('en-US')).toBe('en');
		expect(toGiphyLanguage('es-419')).toBe('es');
		expect(toGiphyLanguage('de')).toBe('de');
	});

	test('maps Chinese to simplified or traditional', () => {
		expect(toGiphyLanguage('zh-CN')).toBe('zh-CN');
		expect(toGiphyLanguage('zh-TW')).toBe('zh-TW');
		expect(toGiphyLanguage('zh-Hant')).toBe('zh-TW');
		expect(toGiphyLanguage('zh')).toBe('zh-CN');
	});
});
