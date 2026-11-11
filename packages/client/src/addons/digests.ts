import { getSha256 } from '~/native/unbound-native';

type BundleDigest = {
	bundle: string;
	digest: string;
};

const bundleDigests = new Map<string, BundleDigest>();
const sourceDigests = new Map<string, string>();

/**
 * @description Records the SHA-256 the loader took of a plugin source it kept back, for update checks.
 * @param id The plugin's id.
 * @param digest The source's SHA-256, in hex.
 */
export function rememberSourceDigest(id: string, digest: string): void {
	sourceDigests.set(id, digest);
}

/**
 * @description Reads an addon's SHA-256 for an update check: its bundle's, hashed once per bundle, or
 * the one the loader took of a source it kept back.
 * @param id The addon's id.
 * @param bundle The bundle source; empty when the loader kept it back.
 * @returns The SHA-256 in hex, or `undefined` when neither is known.
 */
export function digestOf(id: string, bundle: string): string | undefined {
	if (!bundle) {
		return sourceDigests.get(id);
	}

	const cached = bundleDigests.get(id);

	if (cached?.bundle === bundle) {
		return cached.digest;
	}

	const digest = getSha256(bundle);

	bundleDigests.set(id, { bundle, digest });

	return digest;
}

/**
 * @description Throws when a downloaded bundle's SHA-256 is not the one its release lists.
 * @param bundle The bundle source.
 * @param expected The SHA-256 the release lists.
 */
export function assertTextDigest(bundle: string, expected: string): void {
	const digest = getSha256(bundle);

	if (digest !== expected) {
		throw new Error(`Bundle SHA-256 ${digest} does not match ${expected}.`);
	}
}
