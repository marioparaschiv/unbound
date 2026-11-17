import { javaReference, javaString } from '@unbound-plugins/shared/native/android/java-values';
import type { NativeBridge, NativeJavaBridge, NativeJavaReference } from '@unbound-app/api/native';

import type { FontHost } from '~/native/fonts';

const TYPEFACE = 'android.graphics.Typeface';
const ASSETS = 'android.content.res.AssetManager';
const CACHE = 'java.util.LinkedHashMap';
const MAX_CANDIDATES = 20;

type Description = ReturnType<NativeJavaBridge['describe']>;

function isFontManager(description: Description): boolean {
	return description.methods.some(
		(method) =>
			!method.static &&
			method.returnType === TYPEFACE &&
			method.parameters.length === 3 &&
			method.parameters[0] === 'java.lang.String' &&
			method.parameters[2] === ASSETS,
	);
}

async function findCustomTypefaces(
	java: NativeJavaBridge,
): Promise<NativeJavaReference | undefined> {
	const names = await java.findClasses({
		methods: [{ returns: TYPEFACE, static: false }],
		fields: [{ type: CACHE }],
		limit: MAX_CANDIDATES,
	});

	for (const name of names) {
		const description = java.describe(name);
		const self = description.fields.find((field) => field.static && field.type === name);
		const caches = description.fields.filter((field) => !field.static && field.type === CACHE);

		if (!isFontManager(description) || !self || caches.length < 2) continue;

		const manager = javaReference(java.getField(java.getClass(name), self.name));

		return manager
			? (javaReference(java.getField(manager, caches[1]!.name)) ?? undefined)
			: undefined;
	}

	return undefined;
}

function inflate(java: NativeJavaBridge, compressed: Uint8Array): Uint8Array {
	const sink = java.construct('java.io.ByteArrayOutputStream', []);
	const stream = java.construct('java.util.zip.InflaterOutputStream', [sink]);

	java.invoke(stream, 'write', [{ type: 'bytes', value: compressed }]);
	java.invoke(stream, 'close', []);

	const bytes = javaReference(java.invoke(sink, 'toByteArray', []));

	if (!bytes) throw new Error('the font table did not inflate');

	return java.bytes(bytes);
}

async function register(
	java: NativeJavaBridge,
	customTypefaces: Promise<NativeJavaReference | undefined>,
	path: string,
	family: string,
): Promise<string> {
	const typeface = javaReference(
		java.invoke(java.getClass(TYPEFACE), 'createFromFile', [javaString(path)]),
	);
	const cache = await customTypefaces;

	if (!typeface) throw new Error('Android could not read the font');
	if (!cache) throw new Error('found no React Native font cache');

	java.invoke(cache, 'put', [javaString(family), typeface]);

	return family;
}

/**
 * @description Loads fonts on Android: `InflaterOutputStream` for WOFF tables, `Typeface.createFromFile` put in
 * React Native's custom typeface cache under the given family.
 * @param bridge The plugin's native bridge.
 * @returns The font host.
 */
export function createFontHost(bridge: NativeBridge): FontHost {
	const java = bridge.java as NativeJavaBridge;
	let customTypefaces: Promise<NativeJavaReference | undefined> | undefined;

	return {
		inflate: (compressed) => inflate(java, compressed),
		register: (path, family) => {
			customTypefaces ??= findCustomTypefaces(java);

			return register(java, customTypefaces, path, family);
		},
	};
}
