import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { generateKeyPairSync } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { parseVerifyArguments, verifyBuild } from './verify-signatures';
import { MANIFEST_FILE, signBundles } from './sign';

function makeKey() {
	const { privateKey, publicKey } = generateKeyPairSync('ed25519');
	const der = publicKey.export({ format: 'der', type: 'spki' });

	return {
		pem: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
		publicKeyBase64: der.subarray(der.length - 32).toString('base64'),
	};
}

function makeBuild() {
	const root = mkdtempSync(join(tmpdir(), 'unbound-verify-'));
	const dist = join(root, 'dist');
	const keys = join(root, 'keys');

	mkdirSync(dist);
	mkdirSync(keys);
	writeFileSync(join(dist, 'unbound.js'), 'console.log(1);');
	writeFileSync(
		join(dist, MANIFEST_FILE),
		JSON.stringify({
			revision: 'abc1234',
			channel: 'beta',
			buildTime: '2026-10-27T12:00:00Z',
		}),
	);

	return { dist, keys };
}

describe('verify-signatures', () => {
	test('parses --dir and --pr', () => {
		expect(parseVerifyArguments([], '/client')).toEqual({
			dir: '/client/dist',
			pullRequest: 0,
		});
		expect(parseVerifyArguments(['--pr', '12', '--dir', 'out'], '/client')).toEqual({
			dir: '/client/out',
			pullRequest: 12,
		});
		expect(() => parseVerifyArguments(['--pr', 'x'])).toThrow(
			'--pr needs a pull request number',
		);
		expect(() => parseVerifyArguments(['--strict'])).toThrow('Unknown argument --strict');
	});

	test('checks a production build against the production key', () => {
		const { dist, keys } = makeBuild();
		const production = makeKey();

		writeFileSync(join(keys, 'bundle-signing.pub'), `${production.publicKeyBase64}\n`);
		signBundles(dist, production.pem);

		expect(verifyBuild({ dir: dist, pullRequest: 0 }, keys).status).toBe('verified');
	});

	test('checks a pull request build against the pull request key and its number', () => {
		const { dist, keys } = makeBuild();
		const production = makeKey();
		const pullRequest = makeKey();

		writeFileSync(join(keys, 'bundle-signing.pub'), production.publicKeyBase64);
		writeFileSync(join(keys, 'pr-bundle-signing.pub'), pullRequest.publicKeyBase64);
		signBundles(dist, pullRequest.pem, { pullRequest: 5 });

		expect(verifyBuild({ dir: dist, pullRequest: 5 }, keys).status).toBe('verified');

		const otherNumber = verifyBuild({ dir: dist, pullRequest: 6 }, keys);

		expect(otherNumber.status).toBe('failed');

		const productionCheck = verifyBuild({ dir: dist, pullRequest: 0 }, keys);

		expect(productionCheck).toMatchObject({
			status: 'failed',
			problems: [expect.stringMatching(/^manifest\.json/)],
		});
	});

	test('skips when the key is not committed', () => {
		const { dist, keys } = makeBuild();

		expect(verifyBuild({ dir: dist, pullRequest: 3 }, keys)).toEqual({
			status: 'skipped',
			keyPath: join(keys, 'pr-bundle-signing.pub'),
		});
	});
});
