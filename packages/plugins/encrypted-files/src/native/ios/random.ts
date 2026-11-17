import type { NativeBridge } from '@unbound-app/api/native';

/**
 * @description Reads random bytes from iOS's `SecRandomCopyBytes`.
 * @param native The plugin's native bridge.
 * @returns A function that fills an array with random bytes.
 */
export function secureRandomIOS({ ffi }: NativeBridge): (out: Uint8Array) => void {
	const copyBytes = ffi.symbol('SecRandomCopyBytes');

	if (!copyBytes) throw new Error('SecRandomCopyBytes is missing');

	return (out) => {
		const buffer = ffi.alloc(out.byteLength);

		try {
			const status = ffi.call(
				copyBytes,
				{ returnType: 'i32', args: ['pointer', 'u64', 'pointer'] },
				null,
				BigInt(out.byteLength),
				buffer,
			);

			if (status !== 0) throw new Error(`SecRandomCopyBytes returned ${String(status)}`);

			out.set(ffi.readBytes(buffer, out.byteLength));
		} finally {
			ffi.free(buffer);
		}
	};
}
