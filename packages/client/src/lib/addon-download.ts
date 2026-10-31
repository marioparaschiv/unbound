import type { AddonManifest, AddonTrust } from '@unbound-app/types';

import { compiledBundlePath } from '~/lib/addon-paths';

/** Turns the JSON a manifest URL served into a manifest, throwing when it is malformed. */
// UNKNOWN: the parser receives whatever JSON the server sent.
export type ManifestParser = (raw: unknown) => AddonManifest;

/**
 * @description Downloads an addon manifest and parses it.
 * @param url The manifest URL.
 * @param parse Parses the downloaded JSON.
 * @returns The parsed manifest.
 */
export async function downloadManifest(url: string, parse: ManifestParser): Promise<AddonManifest> {
	const res = await fetch(url, { cache: 'no-cache' });

	if (!res.ok) {
		throw new Error(`Failed to fetch manifest (${res.status}).`);
	}

	return parse(await res.json());
}

/**
 * @description Downloads an addon bundle.
 * @param url The bundle URL.
 * @returns The bundle source.
 */
export async function downloadBundle(url: string): Promise<string> {
	const res = await fetch(url, { cache: 'no-cache' });

	if (!res.ok) {
		throw new Error(`Failed to fetch bundle (${res.status}).`);
	}

	return res.text();
}

/**
 * @description Downloads the bundle compiled for this runtime's Hermes bytecode version, when the manifest lists one.
 * @param manifest The addon's manifest.
 * @param bundleUrl The source bundle's URL, beside which the compiled bundle is published.
 * @returns The compiled bundle, base64-encoded, or `undefined` when there is none for this runtime.
 */
export async function downloadBytecode(
	manifest: AddonManifest,
	bundleUrl: string,
): Promise<string | undefined> {
	const bytecodeVersion = globalThis.UNBOUND_LOADER?.bytecodeVersion;

	if (!bytecodeVersion || !manifest.bytecode?.[String(bytecodeVersion)]) return;

	const res = await fetch(compiledBundlePath(bundleUrl, bytecodeVersion), { cache: 'no-cache' });

	if (!res.ok) {
		throw new Error(`status ${res.status}`);
	}

	return Buffer.from(await res.arrayBuffer()).toString('base64');
}

/**
 * @description Checks a downloaded addon's signature against the keys compiled into the loader and
 * records the result as `trust`. A mismatched signature, or an unsigned bundle replacing a signed one, is refused.
 * @param manifest The downloaded manifest.
 * @param bundle The downloaded bundle.
 * @param installedTrust The trust of the installed copy the download replaces, if any.
 * @returns The manifest with `trust` set.
 */
export function verifySignature(
	manifest: AddonManifest,
	bundle: string,
	installedTrust?: AddonTrust,
): AddonManifest {
	const addons = globalThis.NativePlatform?.addons;
	const { trust: _ignored, ...rest } = manifest;

	if (!addons) {
		return { ...rest, trust: 'unsigned' };
	}

	const result = addons.verify(JSON.stringify(rest), bundle);

	if (result.status === 'invalid') {
		throw new Error(
			`Refused ${manifest.id}: ${result.problem ?? 'its signature does not match'}.`,
		);
	}

	if (result.status === 'unsigned' && installedTrust === 'signed') {
		throw new Error(
			`Refused ${manifest.id}: the installed version is signed but this one is not.`,
		);
	}

	return { ...rest, trust: result.status };
}

export default { downloadManifest, downloadBundle, downloadBytecode, verifySignature };
