import { describe, expect, test } from 'bun:test';

import { decideHermescRelease, parsePublishedVersions } from '~/hermesc-version';

describe('hermesc release decision', () => {
	test('builds <bytecode>.0.0 when nothing is published', () => {
		expect(decideHermescRelease('96', [])).toEqual({
			shouldBuild: true,
			packageVersion: '96.0.0',
		});
	});

	test('skips a bytecode version that is already published', () => {
		expect(decideHermescRelease('96', ['95.0.0', '96.0.0'])).toEqual({
			shouldBuild: false,
			packageVersion: '96.0.0',
		});
	});

	test('builds an unpublished override', () => {
		expect(decideHermescRelease('96', ['96.0.0'], '96.0.1')).toEqual({
			shouldBuild: true,
			packageVersion: '96.0.1',
		});
	});

	test('skips an override that is already published', () => {
		expect(decideHermescRelease('96', ['96.0.1'], '96.0.1')).toEqual({
			shouldBuild: false,
			packageVersion: '96.0.1',
		});
	});

	test('rejects an unreadable bytecode version', () => {
		expect(() => decideHermescRelease('', [])).toThrow(/Invalid bytecode version/);
		expect(() => decideHermescRelease('abc', [])).toThrow(/Invalid bytecode version/);
	});
});

describe('npm versions output', () => {
	test('parses an array', () => {
		expect(parsePublishedVersions('["95.0.0","96.0.0"]')).toEqual(['95.0.0', '96.0.0']);
	});

	test('parses the bare string npm prints for one version', () => {
		expect(parsePublishedVersions('"96.0.0"')).toEqual(['96.0.0']);
	});

	test('parses empty output as unpublished', () => {
		expect(parsePublishedVersions('')).toEqual([]);
		expect(parsePublishedVersions('   ')).toEqual([]);
	});
});
