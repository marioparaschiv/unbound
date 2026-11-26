import type { NativeBridge } from '@unbound-app/api/native';
import { native } from '@unbound-app/api';
import nacl from 'tweetnacl';

import { secureRandomAndroid as android } from '~/native/android/random';
import { secureRandomIOS as ios } from '~/native/ios/random';

const platformRandom = native.definePlatform({ ios, android });

/**
 * @description Gives NaCl the system's secure random source, since Hermes has no `crypto.getRandomValues`. Reads one
 * byte first, so a bridge that is present but unusable skips the plugin instead of failing when a key is made.
 * @param bridge The plugin's native bridge.
 * @returns Whether a working source was found; without one, NaCl refuses to make keys.
 */
export function useSecureRandom(bridge: NativeBridge): boolean {
	let fill: (out: Uint8Array) => void;

	try {
		fill = platformRandom(bridge);
		fill(new Uint8Array(1));
	} catch (error) {
		logger.warn('Encrypted Files skipped: the secure random source failed:', error);

		return false;
	}

	nacl.setPRNG((out, length) => {
		const bytes = new Uint8Array(length);

		fill(bytes);
		out.set(bytes);
	});

	return true;
}
