import { javaInt, javaReference } from '@unbound-plugins/shared/native/android/java-values';
import type { NativeBridge } from '@unbound-app/api/native';

/**
 * @description Reads random bytes from Android's `SecureRandom`.
 * @param native The plugin's native bridge.
 * @returns A function that fills an array with random bytes.
 */
export function secureRandomAndroid({ java }: NativeBridge): (out: Uint8Array) => void {
	const random = java.construct('java.security.SecureRandom', []);

	return (out) => {
		const bytes = javaReference(java.invoke(random, 'generateSeed', [javaInt(out.byteLength)]));

		if (!bytes) throw new Error('SecureRandom returned nothing');

		out.set(java.bytes(bytes));
	};
}
