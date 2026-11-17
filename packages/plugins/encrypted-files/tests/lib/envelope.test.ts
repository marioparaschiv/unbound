import { describe, expect, test } from 'bun:test';
import nacl from 'tweetnacl';

import { isEnvelope, open, seal } from '~/lib/envelope';
import { fingerprint, fromBase64, keyText, readKeyText, toBase64 } from '~/lib/key-text';

const alice = nacl.box.keyPair();
const bob = nacl.box.keyPair();
const eve = nacl.box.keyPair();
const file = new TextEncoder().encode('the secret file');

describe('seal and open', () => {
	test('lets the recipient and the sender open the file, with its name', () => {
		const envelope = seal(file, 'notes.txt', alice, [bob.publicKey]);

		expect(isEnvelope(envelope)).toBe(true);
		expect(open(envelope, bob)).toEqual({ name: 'notes.txt', bytes: file });
		expect(open(envelope, alice)).toEqual({ name: 'notes.txt', bytes: file });
	});

	test('keeps everyone else out', () => {
		expect(open(seal(file, 'a', alice, [bob.publicKey]), eve)).toBeUndefined();
	});

	test('rejects a changed file', () => {
		const envelope = seal(file, 'a', alice, [bob.publicKey]);

		envelope[envelope.length - 1]! ^= 1;

		expect(open(envelope, bob)).toBeUndefined();
	});

	test('does not wrap the key twice when the sender is also listed', () => {
		const once = seal(file, 'a', alice, [bob.publicKey]);
		const twice = seal(file, 'a', alice, [bob.publicKey, alice.publicKey]);

		expect(twice.byteLength).toBe(once.byteLength);
	});

	test('ignores files that are not envelopes', () => {
		expect(open(file, bob)).toBeUndefined();
	});
});

describe('key text', () => {
	test('round-trips a public key through a message', () => {
		expect(readKeyText(`here: ${keyText(bob.publicKey)} thanks`)).toEqual(bob.publicKey);
		expect(readKeyText('no key here')).toBeUndefined();
	});

	test('round-trips base64 of every length', () => {
		for (const size of [0, 1, 2, 3, 31, 32, 33]) {
			const bytes = nacl.randomBytes(size);

			expect(fromBase64(toBase64(bytes))).toEqual(bytes);
		}
	});

	test('gives a stable fingerprint', () => {
		expect(fingerprint(bob.publicKey)).toBe(fingerprint(new Uint8Array(bob.publicKey)));
		expect(fingerprint(bob.publicKey)).toMatch(/^([0-9a-f]{4} ){7}[0-9a-f]{4}$/);
	});
});
