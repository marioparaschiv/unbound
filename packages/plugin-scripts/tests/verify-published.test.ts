import { describe, expect, test } from 'bun:test';

import { checkRelease, digestOf, orphanedListings } from '~/verify-published';

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
			'https://cdn.test/sample/index.98.hbc': 'compiled',
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
			'https://cdn.test/sample/index.98.hbc': 'recompiled',
		});
		const problems = (await checkRelease(release, fetcher)).join('\n');

		expect(problems).toContain("served bundle's SHA-256");
		expect(problems).toContain("bytecode 98 bundle's SHA-512 does not match");
		expect(problems).toContain(
			'bytecode 99 bundle at https://cdn.test/sample/index.99.hbc answered 404',
		);
	});
});

describe('orphanedListings', () => {
	test('names first-party listings no plugin owns, across pages', async () => {
		const fetcher = served({
			'https://api.test/api/v1/addons?type=plugin&limit=50': JSON.stringify({
				addons: [{ id: 'unbound.hide-buttons' }, { id: 'unbound.hide-gift-button' }],
				nextCursor: 'next',
			}),
			'https://api.test/api/v1/addons?type=plugin&limit=50&cursor=next': JSON.stringify({
				addons: [{ id: 'someone.other' }, { id: 'unbound.gone' }],
				nextCursor: null,
			}),
		});

		const problems = await orphanedListings(
			'https://api.test',
			[{ id: 'unbound.hide-buttons' }],
			fetcher,
		);

		expect(problems).toHaveLength(2);
		expect(problems[0]).toStartWith('unbound.hide-gift-button is still listed');
		expect(problems[1]).toStartWith('unbound.gone is still listed');
	});
});
