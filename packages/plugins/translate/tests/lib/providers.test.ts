import { describe, expect, test } from 'bun:test';

import { readGoogle, readMyMemory, serviceUrl, servicesToTry } from '~/lib/providers';

describe('translation services', () => {
	test('Automatic uses Unbound once signed in, and Google then MyMemory before', () => {
		expect(servicesToTry('auto', true)).toEqual(['unbound']);
		expect(servicesToTry('auto', false)).toEqual(['google', 'mymemory']);
		expect(servicesToTry('mymemory', true)).toEqual(['mymemory']);
	});

	test('reads Google sentence pairs and the detected language', () => {
		const payload = [
			[
				['Hallo ', 'Hello ', null],
				['Welt', 'world', null],
			],
			null,
			'en',
		];

		expect(readGoogle(payload)).toEqual({ text: 'Hallo Welt', detected: 'en' });
		expect(readGoogle([['Guten Morgen', 'en']])).toEqual({
			text: 'Guten Morgen',
			detected: 'en',
		});
		expect(readGoogle({ error: 1 })).toBeUndefined();
	});

	test('reads MyMemory and treats its in-body errors as failures', () => {
		expect(
			readMyMemory({ responseStatus: 200, responseData: { translatedText: 'Hallo' } }),
		).toEqual({ text: 'Hallo', detected: undefined });
		expect(
			readMyMemory({ responseStatus: 403, responseData: { translatedText: 'INVALID' } }),
		).toBeUndefined();
	});

	test('builds each service URL with the text encoded', () => {
		const request = { text: 'a b&c', source: 'auto', target: 'de' };

		expect(serviceUrl('google', request)).toContain(
			'client=dict-chrome-ex&sl=auto&tl=de&q=a%20b%26c',
		);
		expect(serviceUrl('mymemory', request)).toContain('langpair=autodetect%7Cde');
	});
});
