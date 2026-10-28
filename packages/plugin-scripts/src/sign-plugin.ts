import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import type { KeyObject } from 'node:crypto';

export const PLUGIN_SIGNING_KEY_VARIABLE = 'UNBOUND_BUNDLE_SIGNING_KEY';

export type PluginSignature = {
	version: 1;
	ed25519: string;
};

export type BytecodeDigests = Record<string, string>;

/**
 * @description Builds the exact text a plugin signature covers, matching `addonSigningMessage` in the loader core.
 * @param id The plugin's manifest id.
 * @param version The plugin's manifest version.
 * @param bundle The built bundle exactly as it is published.
 * @param bytecode The manifest's `bytecode` digests, by Hermes bytecode version.
 * @returns `unbound-addon/v1`, the id, the version and the bundle's SHA-512, one per line, then one `bytecode <version> <digest>` line per compiled bundle in version order.
 */
export function pluginSigningMessage(
	id: string,
	version: string,
	bundle: Uint8Array,
	bytecode: BytecodeDigests = {},
): string {
	const digest = createHash('sha512').update(bundle).digest('hex');
	const compiled = Object.entries(bytecode)
		.sort(([left], [right]) => Number(left) - Number(right))
		.map(
			([bytecodeVersion, bytecodeDigest]) =>
				`\nbytecode ${bytecodeVersion} ${bytecodeDigest}`,
		);

	return `unbound-addon/v1\n${id}\n${version}\n${digest}${compiled.join('')}`;
}

/**
 * @description Hashes each compiled bundle for the manifest's `bytecode` field.
 * @param compiled The compiled bundles, by Hermes bytecode version.
 * @returns Each bundle's SHA-512, by version.
 */
export function bytecodeDigests(compiled: ReadonlyMap<number, Uint8Array>): BytecodeDigests {
	return Object.fromEntries(
		[...compiled].map(([bytecodeVersion, bytecode]) => [
			String(bytecodeVersion),
			createHash('sha512').update(bytecode).digest('hex'),
		]),
	);
}

/**
 * @description Parses the PEM PKCS#8 Ed25519 key that signs client bundles and plugins.
 * @param pem The private key in PEM form.
 * @returns The private key.
 */
export function parsePluginSigningKey(pem: string): KeyObject {
	const key = createPrivateKey(pem.replaceAll('\r', ''));

	if (key.asymmetricKeyType !== 'ed25519') {
		throw new Error(`${PLUGIN_SIGNING_KEY_VARIABLE} must be an Ed25519 key.`);
	}

	return key;
}

/**
 * @description Signs a plugin's built bundle for its manifest id and version.
 * @param key The Ed25519 private key.
 * @param id The plugin's manifest id.
 * @param version The plugin's manifest version.
 * @param bundle The built bundle exactly as it is published.
 * @param bytecode The manifest's `bytecode` digests, by Hermes bytecode version.
 * @returns The signature to store as the manifest's `signature` field.
 */
export function signPlugin(
	key: KeyObject,
	id: string,
	version: string,
	bundle: Uint8Array,
	bytecode: BytecodeDigests = {},
): PluginSignature {
	const message = Buffer.from(pluginSigningMessage(id, version, bundle, bytecode));

	return { version: 1, ed25519: sign(null, message, key).toString('base64') };
}

/**
 * @description Checks a plugin signature against a public key, as the loader does.
 * @param publicKey The Ed25519 public key, raw 32 bytes as base64.
 * @param id The plugin's manifest id.
 * @param version The plugin's manifest version.
 * @param bundle The built bundle.
 * @param signature The manifest's `signature` field.
 * @param bytecode The manifest's `bytecode` digests, by Hermes bytecode version.
 * @returns Whether the signature matches.
 */
export function verifyPluginSignature(
	publicKey: string,
	id: string,
	version: string,
	bundle: Uint8Array,
	signature: PluginSignature,
	bytecode: BytecodeDigests = {},
): boolean {
	const key = createPublicKey({
		key: Buffer.concat([
			Buffer.from('302a300506032b6570032100', 'hex'),
			Buffer.from(publicKey, 'base64'),
		]),
		format: 'der',
		type: 'spki',
	});
	const message = Buffer.from(pluginSigningMessage(id, version, bundle, bytecode));

	return verify(null, message, key, Buffer.from(signature.ed25519, 'base64'));
}

/**
 * @description Adds a signature to a plugin's manifest text, keeping its tab indentation.
 * @param manifestText The plugin's `manifest.json` source.
 * @param signature The signature over its built bundle.
 * @param bytecode The digests the signature covers, set as `bytecode` when there are any.
 * @returns The manifest text with `signature` set.
 */
export function withSignature(
	manifestText: string,
	signature: PluginSignature,
	bytecode: BytecodeDigests = {},
): string {
	const manifest = JSON.parse(manifestText) as Record<string, unknown>;
	const compiled = Object.keys(bytecode).length > 0 ? { bytecode } : {};

	return `${JSON.stringify({ ...manifest, ...compiled, signature }, null, '\t')}\n`;
}
