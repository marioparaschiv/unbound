import { describe, expect, test } from 'bun:test';

import { checkRelease, compiledBundleUrl, digestOf } from './verify-published';

const encoder = new TextEncoder();

function served(files: Record<string, string>) {
	return async (url: string) => {
		const body = files[url];

		return body === undefined ? new Response('missing', { status: 404 }) : new Response(body);
	};
}

function sha(text: string, algorithm: 'sha256' | 'sha512') {
	return digestOf(encoder.encode(text).buffer as ArrayBuffer, algorithm);
}

function manifestWith(bytecode: Record<string, string>) {
	return JSON.stringify({
		id: 'unbound.sample',
		name: 'Sample',
		description: 'A sample plugin.',
		version: '1.0.0',
		main: 'index.js',
		authors: [{ name: 'adrian', id: '1' }],
		bytecode,
	});
}

const release = {
	id: 'unbound.sample',
	manifestUrl: 'https://cdn.test/sample/manifest.json',
	bundleUrl: 'https://cdn.test/sample/index.js',
	sha256: sha('bundle', 'sha256'),
};

describe('checkRelease', () => {
	test('passes a release whose bundle and bytecode match', async () => {
		const fetcher = served({
			[release.bundleUrl]: 'bundle',
			[release.manifestUrl]: manifestWith({ 98: sha('compiled', 'sha512') }),
			[compiledBundleUrl(release.bundleUrl, '98')]: 'compiled',
		});

		expect(await checkRelease(release, fetcher)).toEqual([]);
	});

	test('reports a stale bundle and missing or changed bytecode', async () => {
		const fetcher = served({
			[release.bundleUrl]: 'stale bundle',
			[release.manifestUrl]: manifestWith({
				98: sha('compiled', 'sha512'),
				99: sha('other', 'sha512'),
			}),
			[compiledBundleUrl(release.bundleUrl, '98')]: 'recompiled',
		});
		const problems = (await checkRelease(release, fetcher)).join('\n');

		expect(problems).toContain("served bundle's SHA-256");
		expect(problems).toContain("bytecode 98 bundle's SHA-512 does not match");
		expect(problems).toContain(
			'bytecode 99 bundle at https://cdn.test/sample/index.99.hbc answered 404',
		);
	});
});

describe('compiledBundleUrl', () => {
	test('swaps the extension for the bytecode version', () => {
		expect(compiledBundleUrl('https://cdn.test/a/index.js', '98')).toBe(
			'https://cdn.test/a/index.98.hbc',
		);
	});
});
