import type { AddonManifest, NativeBridgeCapability } from '@unbound-app/types';

import { resolveManifestPlatforms } from '~/addons/manifest';
import { consentCapabilities } from '~/native/consent';

const FIRST_PARTY_PREFIX = 'unbound.';
const HOOK_CAPABILITIES: readonly NativeBridgeCapability[] = [
	'native.objc.hooks',
	'native.java.hooks',
];

/** What an addon will do that the user should know before installing it, as message lines. */
export type InstallUse =
	| { key: 'UNBOUND_INSTALL_REVIEW_HOSTS'; hosts: string }
	| { key: 'UNBOUND_INSTALL_REVIEW_HOOKS' }
	| { key: 'UNBOUND_INSTALL_REVIEW_FFI' }
	| { key: 'UNBOUND_INSTALL_REVIEW_TOKEN' };

function capabilitiesOf(manifest: AddonManifest): NativeBridgeCapability[] {
	return Object.values(resolveManifestPlatforms(manifest).capabilities).flatMap(
		(capabilities) => capabilities ?? [],
	);
}

/**
 * @description Lists what a third-party addon's manifest says it will do: the hosts it connects to, whether it hooks
 * Discord's native code, whether it calls native functions directly and whether it reads the account token. First-party addons list nothing.
 * @param manifest The version about to install.
 * @returns The uses to show, in that order.
 */
export function installUses(manifest: AddonManifest): InstallUse[] {
	if (manifest.id.startsWith(FIRST_PARTY_PREFIX)) {
		return [];
	}

	const capabilities = capabilitiesOf(manifest);
	const uses: InstallUse[] = [];

	if (manifest.network?.length) {
		uses.push({ key: 'UNBOUND_INSTALL_REVIEW_HOSTS', hosts: manifest.network.join(', ') });
	}

	if (capabilities.some((capability) => HOOK_CAPABILITIES.includes(capability))) {
		uses.push({ key: 'UNBOUND_INSTALL_REVIEW_HOOKS' });
	}

	if (consentCapabilities(manifest).length) {
		uses.push({ key: 'UNBOUND_INSTALL_REVIEW_FFI' });
	}

	if (manifest.permissions?.includes('account-token')) {
		uses.push({ key: 'UNBOUND_INSTALL_REVIEW_TOKEN' });
	}

	return uses;
}

export default installUses;
