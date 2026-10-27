import { createPrivateKey, createPublicKey, sign, verify, type KeyObject } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import Logger from '@unbound-app/logger';
import { join } from 'node:path';

const logger = Logger.create('Build', 'Sign');

export const SIGNING_KEY_VARIABLE = 'UNBOUND_BUNDLE_SIGNING_KEY';

export const SIGNATURE_SUFFIX = '.sig';

/**
 * @description Lists the client bundles in a build directory that the loader may download.
 * @param dir The build output directory.
 * @returns The bundle file names, sorted.
 */
export function signableBundles(dir: string): string[] {
	return readdirSync(dir)
		.filter(
			(file) =>
				file.startsWith('unbound.') && (file === 'unbound.js' || file.endsWith('.bundle')),
		)
		.sort();
}

/**
 * @description Parses the signing key, failing unless it is an Ed25519 private key.
 * @param pem The PEM private key.
 * @returns The parsed key.
 */
export function parseSigningKey(pem: string): KeyObject {
	const key = createPrivateKey(pem.replaceAll('\r', ''));

	if (key.asymmetricKeyType !== 'ed25519') {
		throw new Error(`${SIGNING_KEY_VARIABLE} must be an Ed25519 private key.`);
	}

	return key;
}

/**
 * @description Writes a base64 Ed25519 signature next to every bundle in a build directory, after removing stale ones. Without a key the bundles stay unsigned.
 * @param dir The build output directory.
 * @param pem The PEM private key, read from {@link SIGNING_KEY_VARIABLE} by default.
 * @returns The bundle file names that were signed.
 */
export function signBundles(dir: string, pem = process.env[SIGNING_KEY_VARIABLE]): string[] {
	for (const file of readdirSync(dir).filter((name) => name.endsWith(SIGNATURE_SUFFIX))) {
		rmSync(join(dir, file));
	}

	if (!pem?.trim()) {
		logger.warn(`${SIGNING_KEY_VARIABLE} is not set; the bundles are unsigned.`);

		return [];
	}

	const key = parseSigningKey(pem);
	const bundles = signableBundles(dir);

	for (const file of bundles) {
		const signature = sign(null, readFileSync(join(dir, file)), key).toString('base64');

		writeFileSync(join(dir, `${file}${SIGNATURE_SUFFIX}`), `${signature}\n`);
	}

	logger.success(`Signed ${bundles.join(', ')}`);

	return bundles;
}

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

/**
 * @description Parses a raw 32-byte Ed25519 public key encoded as base64, the format the loader compiles in.
 * @param base64 The base64 public key.
 * @returns The parsed key.
 */
export function parsePublicKey(base64: string): KeyObject {
	const raw = Buffer.from(base64.trim(), 'base64');

	if (raw.length !== 32) {
		throw new Error(`The bundle signing public key is ${raw.length} bytes, not 32.`);
	}

	return createPublicKey({
		key: Buffer.concat([ED25519_SPKI_PREFIX, raw]),
		format: 'der',
		type: 'spki',
	});
}

/**
 * @description Checks that every bundle in a build directory carries a signature the public key verifies.
 * @param dir The build output directory.
 * @param publicKeyBase64 The raw Ed25519 public key as base64.
 * @returns A problem per bundle with a missing or invalid signature, empty when all verify.
 */
export function findUnsignedBundles(dir: string, publicKeyBase64: string): string[] {
	const key = parsePublicKey(publicKeyBase64);
	const bundles = signableBundles(dir);

	if (!bundles.length) {
		return [`${dir} has no bundles.`];
	}

	return bundles.flatMap((file) => {
		const signaturePath = join(dir, `${file}${SIGNATURE_SUFFIX}`);

		if (!existsSync(signaturePath)) {
			return [`${file} has no signature.`];
		}

		const signature = Buffer.from(readFileSync(signaturePath, 'utf8').trim(), 'base64');
		const valid =
			signature.length === 64 && verify(null, readFileSync(join(dir, file)), key, signature);

		return valid ? [] : [`${file} does not match its signature.`];
	});
}

export default signBundles;
