import { createHash, createPrivateKey, generateKeyPairSync } from 'node:crypto';
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
	bytecodeDigests,
	parsePluginSigningKey,
	pluginSigningMessage,
	signPlugin,
	verifyPluginSignature,
	withSignature,
} from './sign-plugin';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const rawPublicKey = publicKey
	.export({ format: 'der', type: 'spki' })
	.subarray(12)
	.toString('base64');
const bundle = new TextEncoder().encode('(()=>({start(){},stop(){}}))');

describe('plugin signatures', () => {
	test('covers the id, version and bundle digest', () => {
		const digest = createHash('sha512').update('x').digest('hex');

		expect(
			pluginSigningMessage('unbound.example', '1.2.3', new TextEncoder().encode('x')),
		).toBe(`unbound-addon/v1\nunbound.example\n1.2.3\n${digest}`);
	});

	test('covers bytecode digests in version order, as the loader does', () => {
		const sha512 = (text: string) => createHash('sha512').update(text).digest('hex');
		const digests = bytecodeDigests(
			new Map([
				[98, new TextEncoder().encode('98')],
				[96, new TextEncoder().encode('96')],
			]),
		);

		expect(digests).toEqual({ 98: sha512('98'), 96: sha512('96') });
		expect(pluginSigningMessage('a', '1.0.0', new TextEncoder().encode('x'), digests)).toBe(
			`unbound-addon/v1\na\n1.0.0\n${sha512('x')}\nbytecode 96 ${sha512('96')}\nbytecode 98 ${sha512('98')}`,
		);

		const signature = signPlugin(privateKey, 'a', '1.0.0', bundle, digests);

		expect(verifyPluginSignature(rawPublicKey, 'a', '1.0.0', bundle, signature, digests)).toBe(
			true,
		);
		expect(verifyPluginSignature(rawPublicKey, 'a', '1.0.0', bundle, signature)).toBe(false);
		expect(
			verifyPluginSignature(rawPublicKey, 'a', '1.0.0', bundle, signature, {
				...digests,
				98: sha512('tampered'),
			}),
		).toBe(false);
		expect(JSON.parse(withSignature('{"id":"a"}', signature, digests))).toEqual({
			id: 'a',
			bytecode: digests,
			signature,
		});
		expect(JSON.parse(withSignature('{"id":"a"}', signature))).toEqual({ id: 'a', signature });
	});

	test('verifies against the matching public key only', () => {
		const signature = signPlugin(privateKey, 'unbound.example', '1.2.3', bundle);

		expect(signature.version).toBe(1);
		expect(
			verifyPluginSignature(rawPublicKey, 'unbound.example', '1.2.3', bundle, signature),
		).toBe(true);
		expect(
			verifyPluginSignature(rawPublicKey, 'unbound.example', '1.2.4', bundle, signature),
		).toBe(false);
		expect(
			verifyPluginSignature(rawPublicKey, 'unbound.other', '1.2.3', bundle, signature),
		).toBe(false);
		expect(
			verifyPluginSignature(
				rawPublicKey,
				'unbound.example',
				'1.2.3',
				new TextEncoder().encode('tampered'),
				signature,
			),
		).toBe(false);

		const other = generateKeyPairSync('ed25519')
			.publicKey.export({ format: 'der', type: 'spki' })
			.subarray(12);

		expect(
			verifyPluginSignature(
				other.toString('base64'),
				'unbound.example',
				'1.2.3',
				bundle,
				signature,
			),
		).toBe(false);
	});

	test('accepts the PEM PKCS#8 key and rejects other types', () => {
		const pem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();

		expect(parsePluginSigningKey(pem.replaceAll('\n', '\r\n')).asymmetricKeyType).toBe(
			'ed25519',
		);

		const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({
			format: 'pem',
			type: 'pkcs8',
		});

		expect(() => parsePluginSigningKey(rsa.toString())).toThrow('Ed25519');
	});

	test('adds the signature to the manifest and keeps its other fields', () => {
		const signature = signPlugin(privateKey, 'unbound.example', '1.2.3', bundle);
		const text = withSignature(
			'{\n\t"id": "unbound.example",\n\t"version": "1.2.3"\n}\n',
			signature,
		);

		expect(text.endsWith('}\n')).toBe(true);
		expect(text).toContain('\t"id": "unbound.example"');
		expect(JSON.parse(text).signature).toEqual(signature);
	});

	test('produces the vector the loader core test verifies', () => {
		const seeded = createPrivateKey({
			key: Buffer.concat([
				Buffer.from('302e020100300506032b657004220420', 'hex'),
				Buffer.alloc(32, 7),
			]),
			format: 'der',
			type: 'pkcs8',
		});

		expect(signPlugin(seeded, 'unbound.example', '1.2.3', bundle).ed25519).toBe(
			'B/1NUxkn6rRdg/SVy2pTYAbi23ZM0OgMD/u88q6s7NoWxbmvz5EmiKzyyRMXTQk4jNFQpjx+OwMmwlO0nyuEAA==',
		);
	});

	test('matches the loader core signing message', () => {
		const core = readFileSync(
			join(import.meta.dir, '../../loader/core/src/LoaderAddonSignature.cpp'),
			'utf8',
		);

		expect(core).toContain('"unbound-addon/v1\\n" + id + "\\n" + version + "\\n" +');
		expect(core).toContain('(bundleDigest ? *bundleDigest : sha512Hex(bundle))');
		expect(core).toContain('"\\nbytecode " + std::to_string(bytecodeVersion) + " " + digest');
	});
});
