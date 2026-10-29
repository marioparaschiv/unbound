import type { AddonManifest, NativePluginCapability } from '@unbound-app/types';

/** Capabilities that reach native code without the bridge's type and object checks. */
const CONSENT_CAPABILITIES: readonly NativePluginCapability[] = [
	'native.ffi.symbols',
	'native.ffi.call',
];

/** The consent the user gave, keyed by addon id: the capabilities it covered, as {@link consentKey} returns. */
export type NativeConsents = Record<string, string>;

/**
 * @description Lists the consent-gated capabilities a manifest asks for on any platform.
 * @param manifest The addon's manifest.
 * @returns The sorted, de-duplicated capabilities that need the user's consent.
 */
export function consentCapabilities(manifest: AddonManifest): NativePluginCapability[] {
	const requested = [
		...(manifest.capabilities ?? []),
		...Object.values(manifest.platformCapabilities ?? {}).flatMap(
			(capabilities) => capabilities ?? [],
		),
	];

	return [
		...new Set(requested.filter((capability) => CONSENT_CAPABILITIES.includes(capability))),
	].sort();
}

/**
 * @description Builds the value stored when the user consents, so new capabilities ask again.
 * @param manifest The addon's manifest.
 * @returns The consent-gated capabilities joined by commas, or an empty string when none are asked for.
 */
export function consentKey(manifest: AddonManifest): string {
	return consentCapabilities(manifest).join(',');
}

/**
 * @description Decides whether starting an addon needs the user's consent first. Signed first-party
 * addons never do; others do when they ask for a consent-gated capability the user has not allowed.
 * @param manifest The addon's manifest.
 * @param consents The consents the user gave.
 * @returns Whether to ask before starting the addon.
 */
export function needsConsent(manifest: AddonManifest, consents: NativeConsents): boolean {
	const key = consentKey(manifest);

	return key !== '' && manifest.trust !== 'signed' && consents[manifest.id] !== key;
}
