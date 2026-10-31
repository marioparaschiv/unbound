import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash, generateKeyPairSync, verify } from 'node:crypto';
import { describe, expect, test } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
	MANIFEST_FILE,
	PR_SIGNING_KEY_VARIABLE,
	SIGNATURE_SUFFIX,
	SIGNING_KEY_VARIABLE,
	bundleHashes,
	findUnsignedBundles,
	parseSignArguments,
	pullRequestSigningContext,
	signBundles,
	signedMessage,
} from './sign';

const BUILD_MANIFEST = {
	revision: 'abc1234',
	channel: 'beta',
	buildTime: '2026-10-27T12:06:15.507Z',
	bytecodeVersions: [98],
};

function makeDist(manifest: object = BUILD_MANIFEST) {
	const dir = mkdtempSync(join(tmpdir(), 'unbound-sign-'));

	writeFileSync(join(dir, 'unbound.js'), 'console.log(1);');
	writeFileSync(join(dir, 'unbound.98.bundle'), Buffer.from([0xc6, 0x1f, 0xbc, 0x03]));
	writeFileSync(join(dir, 'unbound.98.bundle.map'), '{}');
	writeFileSync(join(dir, MANIFEST_FILE), JSON.stringify(manifest, null, 2));

	return dir;
}

function makeKey() {
	const { privateKey, publicKey } = generateKeyPairSync('ed25519');
	const der = publicKey.export({ format: 'der', type: 'spki' });

	return {
		pem: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
		publicKey,
		publicKeyBase64: der.subarray(der.length - 32).toString('base64'),
	};
}

function signatureOf(dir: string, file: string) {
	return Buffer.from(
		readFileSync(join(dir, `${file}${SIGNATURE_SUFFIX}`), 'utf8').trim(),
		'base64',
	);
}

function sha512(contents: string | Buffer) {
	return createHash('sha512').update(contents).digest('hex');
}

describe('bundle signing', () => {
	test('signs only the manifest, which the public key verifies', () => {
		const dir = makeDist();
		const { pem, publicKey } = makeKey();

		expect(signBundles(dir, pem)).toEqual([MANIFEST_FILE]);

		const signature = signatureOf(dir, MANIFEST_FILE);

		expect(signature).toHaveLength(64);
		expect(verify(null, readFileSync(join(dir, MANIFEST_FILE)), publicKey, signature)).toBe(
			true,
		);

		for (const file of ['unbound.js', 'unbound.98.bundle', 'unbound.98.bundle.map']) {
			expect(existsSync(join(dir, `${file}${SIGNATURE_SUFFIX}`))).toBe(false);
		}
	});

	test('records the SHA-512 of every bundle in the signed manifest', () => {
		const dir = makeDist({
			...BUILD_MANIFEST,
			sha512: { 'unbound.js': 'stale' },
		});

		signBundles(dir, makeKey().pem);

		const manifest = JSON.parse(readFileSync(join(dir, MANIFEST_FILE), 'utf8'));

		expect(manifest).toMatchObject(BUILD_MANIFEST);
		expect(manifest.sha512).toEqual({
			'unbound.98.bundle': sha512(Buffer.from([0xc6, 0x1f, 0xbc, 0x03])),
			'unbound.js': sha512('console.log(1);'),
		});
		expect(bundleHashes(dir)).toEqual(manifest.sha512);
	});

	test('binds pull request signatures to the pull request context', () => {
		const dir = makeDist();
		const { pem, publicKey } = makeKey();

		signBundles(dir, pem, { pullRequest: 5 });

		const contents = readFileSync(join(dir, MANIFEST_FILE));
		const signature = signatureOf(dir, MANIFEST_FILE);

		expect(pullRequestSigningContext(5)).toBe('unbound-pr-bundle/v1/5/');
		expect(signedMessage(contents, 5).toString()).toBe(
			`unbound-pr-bundle/v1/5/${contents.toString()}`,
		);
		expect(verify(null, signedMessage(contents, 5), publicKey, signature)).toBe(true);
		expect(verify(null, signedMessage(contents, 6), publicKey, signature)).toBe(false);
		expect(verify(null, contents, publicKey, signature)).toBe(false);
	});

	test('leaves the build unsigned without a key and drops stale signatures', () => {
		const dir = makeDist();

		signBundles(dir, makeKey().pem);

		expect(signBundles(dir, undefined)).toEqual([]);
		expect(signBundles(dir, '  ')).toEqual([]);
		expect(existsSync(join(dir, `unbound.js${SIGNATURE_SUFFIX}`))).toBe(false);
		expect(existsSync(join(dir, `unbound.98.bundle${SIGNATURE_SUFFIX}`))).toBe(false);
		expect(existsSync(join(dir, `${MANIFEST_FILE}${SIGNATURE_SUFFIX}`))).toBe(false);
	});

	test('fails on a key that is not Ed25519', () => {
		const dir = makeDist();
		const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
		const pem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();

		expect(() => signBundles(dir, pem)).toThrow('must be an Ed25519 private key');
	});

	test('refuses to sign a manifest without a build time, revision or channel', () => {
		const { pem } = makeKey();

		const unsigned = () => signBundles(makeDist({ bytecodeVersions: [98] }), pem);

		expect(unsigned).toThrow(/buildTime/);
		expect(unsigned).toThrow(/revision/);
		expect(unsigned).toThrow(/channel/);
		expect(() => signBundles(makeDist({ ...BUILD_MANIFEST, buildTime: 'today' }), pem)).toThrow(
			'buildTime',
		);
	});
});

describe('sign command', () => {
	test('defaults to the production key and the client dist', () => {
		expect(parseSignArguments([], '/client')).toEqual({
			dir: '/client/dist',
			pullRequest: 0,
			keyVariable: SIGNING_KEY_VARIABLE,
		});
	});

	test('signs a pull request build with the pull request key unless told otherwise', () => {
		expect(parseSignArguments(['--pr', '42', '--dir', 'fork/dist'], '/client')).toEqual({
			dir: '/client/fork/dist',
			pullRequest: 42,
			keyVariable: PR_SIGNING_KEY_VARIABLE,
		});
		expect(parseSignArguments(['--pr', '42', '--key-env', 'OTHER_KEY'], '/client')).toEqual({
			dir: '/client/dist',
			pullRequest: 42,
			keyVariable: 'OTHER_KEY',
		});
	});

	test('rejects malformed arguments', () => {
		expect(() => parseSignArguments(['--pr'])).toThrow('--pr needs a pull request number');
		expect(() => parseSignArguments(['--pr', '0'])).toThrow('--pr needs a pull request number');
		expect(() => parseSignArguments(['--pr', '07'])).toThrow(
			'--pr needs a pull request number',
		);
		expect(() => parseSignArguments(['--key-env', 'lower-case'])).toThrow('Unknown argument');
		expect(() => parseSignArguments(['--sign'])).toThrow('Unknown argument --sign');
	});
});

describe('bundle signature check', () => {
	test('passes a build signed with the matching key', () => {
		const dir = makeDist();
		const { pem, publicKeyBase64 } = makeKey();

		signBundles(dir, pem);

		expect(findUnsignedBundles(dir, publicKeyBase64)).toEqual([]);
	});

	test('names a foreign-key manifest and tampered bundles', () => {
		const dir = makeDist();
		const { pem, publicKeyBase64 } = makeKey();

		signBundles(dir, makeKey().pem);
		expect(findUnsignedBundles(dir, publicKeyBase64)).toEqual([
			expect.stringMatching(/^manifest\.json/),
		]);

		signBundles(dir, pem);
		writeFileSync(join(dir, 'unbound.js'), 'tampered');
		expect(findUnsignedBundles(dir, publicKeyBase64)).toEqual([
			expect.stringMatching(/^unbound\.js /),
		]);
	});

	test('names bundles the signed manifest does not hash', () => {
		const dir = makeDist();
		const { pem, publicKeyBase64 } = makeKey();

		signBundles(dir, pem);
		writeFileSync(join(dir, 'unbound.96.bundle'), 'added later');

		expect(findUnsignedBundles(dir, publicKeyBase64)).toContainEqual(
			expect.stringMatching(/^unbound\.96\.bundle /),
		);
	});

	test('checks pull request signatures against their number', () => {
		const dir = makeDist();
		const { pem, publicKeyBase64 } = makeKey();

		signBundles(dir, pem, { pullRequest: 5 });

		expect(findUnsignedBundles(dir, publicKeyBase64, 5)).toEqual([]);
		expect(findUnsignedBundles(dir, publicKeyBase64, 6)).toEqual([
			expect.stringMatching(/^manifest\.json/),
		]);
		expect(findUnsignedBundles(dir, publicKeyBase64)).toEqual([
			expect.stringMatching(/^manifest\.json/),
		]);
	});

	test('accepts the committed public key formats', () => {
		const keys = join(import.meta.dir, '..', '..', '..', 'loader', 'core', 'keys');

		for (const name of ['bundle-signing.pub', 'pr-bundle-signing.pub']) {
			const committed = readFileSync(join(keys, name), 'utf8');

			expect(() => findUnsignedBundles(makeDist(), committed)).not.toThrow();
		}
	});
});
