import type { SourcePin } from '@unbound-app/contracts/source';
import { describe, expect, test } from 'bun:test';

import { formatBytes, sourceUrl } from '~/marketplace/listing-facts';

const PIN: SourcePin = {
	repository: 'unbound-app/addons',
	repositoryId: 1,
	path: 'plugins/hello',
	ref: 'main',
	commitSha: 'a'.repeat(40),
	bundlePath: 'plugins/hello/dist/index.js',
	bundleBlobSha: 'b'.repeat(40),
};

describe('formatBytes', () => {
	test('reads kilobytes below a megabyte, without a trailing zero', () => {
		expect(formatBytes(12_595)).toBe('12.3 KB');
		expect(formatBytes(2048)).toBe('2 KB');
	});

	test('reads megabytes from one megabyte up', () => {
		expect(formatBytes(1024 * 1024 * 1.5)).toBe('1.5 MB');
	});
});

describe('sourceUrl', () => {
	test('links the addon directory at the pinned commit', () => {
		expect(sourceUrl(PIN)).toBe(
			`https://github.com/unbound-app/addons/tree/${'a'.repeat(40)}/plugins/hello`,
		);
	});

	test('links the repository root when the addon sits there', () => {
		expect(sourceUrl({ ...PIN, path: '' })).toBe(
			`https://github.com/unbound-app/addons/tree/${'a'.repeat(40)}`,
		);
	});
});
