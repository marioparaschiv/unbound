import { createHash } from 'node:crypto';
import { describe, expect, test } from 'bun:test';

import sha256 from './sha256';

function reference(input: string): string {
	return createHash('sha256').update(new TextEncoder().encode(input)).digest('hex');
}

describe('sha256', () => {
	test('matches the FIPS 180-4 vectors', () => {
		expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
		expect(sha256('abc')).toBe(
			'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
		);
		expect(sha256('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
			'248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
		);
	});

	test('matches node:crypto across block boundaries', () => {
		for (let length = 0; length <= 130; length++) {
			const input = 'a'.repeat(length);

			expect(sha256(input)).toBe(reference(input));
		}
	});

	test('hashes the UTF-8 encoding, with lone surrogates as U+FFFD', () => {
		for (const input of ['héllo wörld', '😀 emoji', '\uD800', 'a\uDFFFb']) {
			expect(sha256(input)).toBe(reference(input));
		}
	});
});
