import { isCancellation } from '@unbound-plugins/shared/native/cancellation';
import {
	javaNumber,
	javaReference,
	javaString,
} from '@unbound-plugins/shared/native/android/java-values';
import { currentActivity } from '@unbound-plugins/shared/native/android/views';
import type { NativeJavaBridge, NativeJavaReference } from '@unbound-app/api/native';

import type { FileSizeLookup } from '~/badges';

export type AndroidFileSizes = {
	lookup: FileSizeLookup;
	dispose: () => void;
};

/**
 * @description Reads media file sizes from Android's content resolver, which Discord's picker leaves out, and remembers each answer.
 * @param java The plugin's Java bridge.
 * @returns A lookup for content URIs and a function that releases the resolver.
 */
export function createAndroidFileSizes(java: NativeJavaBridge): AndroidFileSizes {
	const sizes = new Map<string, number | undefined>();
	let resolver: NativeJavaReference | null = null;
	let application: NativeJavaReference | null = null;

	function contentResolver(): NativeJavaReference | null {
		if (resolver) return resolver;

		const activity = application ? null : currentActivity(java);

		application ??= activity
			? javaReference(java.invoke(activity, 'getApplicationContext', []))
			: null;
		resolver = application
			? javaReference(java.invoke(application, 'getContentResolver', []))
			: null;

		return resolver;
	}

	function statSize(uri: string): number | undefined {
		const owner = contentResolver();

		if (!owner) return undefined;

		const parsed = javaReference(
			java.invoke(java.getClass('android.net.Uri'), 'parse', [javaString(uri)]),
		);
		const descriptor = parsed
			? javaReference(java.invoke(owner, 'openFileDescriptor', [parsed, javaString('r')]))
			: null;

		try {
			const size = descriptor
				? javaNumber(java.invoke(descriptor, 'getStatSize', []))
				: undefined;

			return size !== undefined && size >= 0 ? size : undefined;
		} finally {
			if (descriptor) {
				java.invoke(descriptor, 'close', []);
				java.release(descriptor);
			}

			if (parsed) java.release(parsed);
		}
	}

	function lookup(uri: string): number | undefined {
		if (!uri.startsWith('content://')) return undefined;

		if (!sizes.has(uri)) {
			try {
				sizes.set(uri, statSize(uri));
			} catch (error) {
				sizes.set(uri, undefined);
				if (!isCancellation(error)) {
					console.error(
						`[File Size On Picker] Could not read the size of ${uri}:`,
						error,
					);
				}
			}
		}

		return sizes.get(uri);
	}

	function dispose() {
		sizes.clear();

		for (const handle of [resolver, application]) {
			if (handle) java.release(handle);
		}

		resolver = null;
		application = null;
	}

	return { lookup, dispose };
}

export default createAndroidFileSizes;
