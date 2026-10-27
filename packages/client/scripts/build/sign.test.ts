import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { generateKeyPairSync, verify } from 'node:crypto';
import { describe, expect, test } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SIGNATURE_SUFFIX, findUnsignedBundles, signBundles } from './sign';

function makeDist() {
	const dir = mkdtempSync(join(tmpdir(), 'unbound-sign-'));

	writeFileSync(join(dir, 'unbound.js'), 'console.log(1);');
	writeFileSync(join(dir, 'unbound.98.bundle'), Buffer.from([0xc6, 0x1f, 0xbc, 0x03]));
	writeFileSync(join(dir, 'unbound.98.bundle.map'), '{}');
	writeFileSync(join(dir, 'manifest.json'), '{}');

	return dir;
}

function makeKey() {
	const { privateKey, publicKey } = generateKeyPairSync('ed25519');

	return { pem: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(), publicKey };
}

function signatureOf(dir: string, file: string) {
	return Buffer.from(
		readFileSync(join(dir, `${file}${SIGNATURE_SUFFIX}`), 'utf8').trim(),
		'base64',
	);
}

describe('bundle signing', () => {
	test('signs every bundle with a signature the public key verifies', () => {
		const dir = makeDist();
		const { pem, publicKey } = makeKey();

		expect(signBundles(dir, pem)).toEqual(['unbound.98.bundle', 'unbound.js']);

		for (const file of ['unbound.js', 'unbound.98.bundle']) {
			const signature = signatureOf(dir, file);

			expect(signature).toHaveLength(64);
			expect(verify(null, readFileSync(join(dir, file)), publicKey, signature)).toBe(true);
		}

		expect(existsSync(join(dir, `manifest.json${SIGNATURE_SUFFIX}`))).toBe(false);
		expect(existsSync(join(dir, `unbound.98.bundle.map${SIGNATURE_SUFFIX}`))).toBe(false);
	});

	test('a tampered bundle no longer matches its signature', () => {
		const dir = makeDist();
		const { pem, publicKey } = makeKey();

		signBundles(dir, pem);
		writeFileSync(join(dir, 'unbound.js'), 'console.log(2);');

		expect(
			verify(
				null,
				readFileSync(join(dir, 'unbound.js')),
				publicKey,
				signatureOf(dir, 'unbound.js'),
			),
		).toBe(false);
	});

	test('leaves bundles unsigned without a key and drops stale signatures', () => {
		const dir = makeDist();

		signBundles(dir, makeKey().pem);

		expect(signBundles(dir, undefined)).toEqual([]);
		expect(signBundles(dir, '  ')).toEqual([]);
		expect(existsSync(join(dir, `unbound.js${SIGNATURE_SUFFIX}`))).toBe(false);
		expect(existsSync(join(dir, `unbound.98.bundle${SIGNATURE_SUFFIX}`))).toBe(false);
	});

	test('fails on a key that is not Ed25519', () => {
		const dir = makeDist();
		const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
		const pem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();

		expect(() => signBundles(dir, pem)).toThrow('must be an Ed25519 private key');
	});
});

describe('bundle signature check', () => {
	function publicKeyBase64(publicKey: ReturnType<typeof makeKey>['publicKey']) {
		const der = publicKey.export({ format: 'der', type: 'spki' });

		return der.subarray(der.length - 32).toString('base64');
	}

	test('passes a build signed with the matching key', () => {
		const dir = makeDist();
		const { pem, publicKey } = makeKey();

		signBundles(dir, pem);

		expect(findUnsignedBundles(dir, publicKeyBase64(publicKey))).toEqual([]);
	});

	test('names unsigned, tampered and foreign-key bundles', () => {
		const dir = makeDist();
		const { pem, publicKey } = makeKey();

		signBundles(dir, makeKey().pem);
		writeFileSync(join(dir, 'unbound.96.bundle'), 'unsigned');
		expect(findUnsignedBundles(dir, publicKeyBase64(publicKey))).toEqual([
			'unbound.96.bundle has no signature.',
			'unbound.98.bundle does not match its signature.',
			'unbound.js does not match its signature.',
		]);

		signBundles(dir, pem);
		writeFileSync(join(dir, 'unbound.js'), 'tampered');
		expect(findUnsignedBundles(dir, publicKeyBase64(publicKey))).toEqual([
			'unbound.js does not match its signature.',
		]);
	});

	test('accepts the committed public key format', () => {
		const committed = readFileSync(
			join(import.meta.dir, '..', '..', '..', 'loader', 'core', 'keys', 'bundle-signing.pub'),
			'utf8',
		);

		expect(() => findUnsignedBundles(makeDist(), committed)).not.toThrow();
	});
});
