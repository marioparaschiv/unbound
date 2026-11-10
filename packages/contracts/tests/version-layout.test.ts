import { describe, expect, test } from 'bun:test';

import {
	getArtifactKeys,
	getBytecodePath,
	getCdnUrl,
	getVersionDirectory,
	readBytecodeVersion,
} from '~/version-layout';

describe('version layout', () => {
	test('puts a version in its own folder, the bundle at main beside the manifest', () => {
		expect(getVersionDirectory('acme.hello', '1.2.0')).toBe('addons/acme.hello/1.2.0');
		expect(getArtifactKeys('acme.hello', '1.2.0', 'dist/index.js')).toEqual({
			manifest: 'addons/acme.hello/1.2.0/manifest.json',
			bundle: 'addons/acme.hello/1.2.0/dist/index.js',
		});
	});

	test('names the compiled bundle beside its source', () => {
		expect(getBytecodePath('dist/index.js', 98)).toBe('dist/index.98.hbc');
		expect(getBytecodePath('https://example.com/a.b/dist/index.js', '96')).toBe(
			'https://example.com/a.b/dist/index.96.hbc',
		);
		expect(getBytecodePath('index', 94)).toBe('index.94.hbc');
	});

	test('reads back only the bytecode versions it names', () => {
		expect(readBytecodeVersion('index.98.hbc', 'index.js')).toBe('98');
		expect(readBytecodeVersion(getBytecodePath('main.js', 99), 'main.js')).toBe('99');

		for (const name of [
			'index.js',
			'index.x.hbc',
			'index..hbc',
			'other.98.hbc',
			'index.98.js',
		]) {
			expect(readBytecodeVersion(name, 'index.js')).toBeUndefined();
		}
	});

	test('joins CDN URLs whether or not the base ends in a slash', () => {
		for (const base of ['https://cdn.test/prefix', 'https://cdn.test/prefix/']) {
			expect(getCdnUrl(base, 'addons/a/1.0.0/index.js')).toBe(
				'https://cdn.test/prefix/addons/a/1.0.0/index.js',
			);
		}
	});
});
