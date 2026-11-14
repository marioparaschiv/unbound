import { describe, expect, test } from 'bun:test';

import { isListableZip } from '~/lib/kinds';

const url = 'https://cdn.discordapp.com/attachments/1/2/file';

describe('isListableZip', () => {
	test('lists archives by extension or type', () => {
		expect(isListableZip({ url, filename: 'mod.ZIP', size: 10 })).toBe(true);
		expect(isListableZip({ url, filename: 'Unbound.ipa', size: 10 })).toBe(true);
		expect(
			isListableZip({ url, filename: 'download', size: 10, content_type: 'application/zip' }),
		).toBe(true);
	});

	test('leaves out other files, oversized archives and attachments without a URL', () => {
		expect(
			isListableZip({ url, filename: 'notes.txt', size: 10, content_type: 'text/plain' }),
		).toBe(false);
		expect(isListableZip({ url, filename: 'zip', size: 10 })).toBe(false);
		expect(isListableZip({ url, filename: 'huge.zip', size: 30 * 1024 * 1024 })).toBe(false);
		expect(isListableZip({ filename: 'mod.zip', size: 10 })).toBe(false);
	});
});
