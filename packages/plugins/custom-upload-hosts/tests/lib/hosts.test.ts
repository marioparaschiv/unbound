import { describe, expect, test } from 'bun:test';

import { hostFor, parseLines, readLink, type HostSettings } from '~/lib/hosts';

const base: HostSettings = {
	host: 'catbox',
	litterboxExpiry: '24h',
	customUrl: '',
	customFileField: 'file',
	customFields: '',
	customHeaders: '',
	customResponse: 'text',
	customJsonPath: '',
};

describe('upload hosts', () => {
	test('knows Catbox and Litterbox', () => {
		expect(hostFor(base)).toMatchObject({
			url: 'https://catbox.moe/user/api.php',
			fileField: 'fileToUpload',
			fields: { reqtype: 'fileupload' },
			response: 'text',
		});
		expect(hostFor({ ...base, host: 'litterbox', litterboxExpiry: '72h' })?.fields).toEqual({
			reqtype: 'fileupload',
			time: '72h',
		});
	});

	test('builds a custom host from its settings', () => {
		expect(
			hostFor({
				...base,
				host: 'custom',
				customUrl: 'https://up.example.com/api',
				customFileField: 'upload',
				customFields: 'expires = 1d\n\nprivate=true',
				customHeaders: 'Authorization: Bearer abc\nX-Empty:',
				customResponse: 'json',
				customJsonPath: 'data.files.0.url',
			}),
		).toEqual({
			url: 'https://up.example.com/api',
			fileField: 'upload',
			fields: { expires: '1d', private: 'true' },
			headers: { Authorization: 'Bearer abc', 'X-Empty': '' },
			response: 'json',
			jsonPath: 'data.files.0.url',
		});
	});

	test('has no custom host without an http address', () => {
		expect(hostFor({ ...base, host: 'custom', customUrl: 'ftp://x' })).toBeUndefined();
	});

	test('reads lines of pairs', () => {
		expect(parseLines('a=1\n b = two words \nbroken', '=')).toEqual({ a: '1', b: 'two words' });
	});
});

describe('reading the link', () => {
	test('from plain text', () => {
		expect(readLink(' https://files.catbox.moe/abc.png\n', { response: 'text' })).toBe(
			'https://files.catbox.moe/abc.png',
		);
		expect(readLink('Error: too big', { response: 'text' })).toBeUndefined();
	});

	test('from JSON at a path', () => {
		const body = JSON.stringify({ data: { files: [{ url: 'https://x.test/a.png' }] } });

		expect(readLink(body, { response: 'json', jsonPath: 'data.files.0.url' })).toBe(
			'https://x.test/a.png',
		);
		expect(readLink(body, { response: 'json', jsonPath: 'data.missing' })).toBeUndefined();
		expect(readLink('not json', { response: 'json', jsonPath: 'url' })).toBeUndefined();
	});
});
