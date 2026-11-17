import type { NativeBridge } from '@unbound-app/api/native';
import { native } from '@unbound-app/api';
import nacl from 'tweetnacl';

import { secureRandomAndroid as android } from '~/native/android/random';
import { secureRandomIOS as ios } from '~/native/ios/random';

const platformRandom = native.definePlatform({ ios, android });

/**
 * @description Gives NaCl the system's secure random source, since Hermes has no `crypto.getRandomValues`.
 * @param bridge The plugin's native bridge.
 * @returns Whether a source was found; without one, NaCl refuses to make keys.
 */
export function useSecureRandom(bridge: NativeBridge): boolean {
	const fill = platformRandom(bridge);

	if (!fill) return false;

	nacl.setPRNG((out, length) => {
		const bytes = new Uint8Array(length);

		fill(bytes);
		out.set(bytes);
	});

	return true;
}
