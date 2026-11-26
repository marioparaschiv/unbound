import {
	javaInt,
	javaReference,
	javaString,
} from '@unbound-plugins/shared/native/android/java-values';
import type { NativeBridge, NativeJavaBridge, NativeJavaReference } from '@unbound-app/api/native';

import type { FontHost } from '../font-host';

const TYPEFACE = 'android.graphics.Typeface';
const ASSETS = 'android.content.res.AssetManager';
const CACHE = 'java.util.LinkedHashMap';
const MAX_CANDIDATES = 20;

type Description = ReturnType<NativeJavaBridge['describe']>;

/** React Native's font manager: its typeface lookup by family, style and assets, and its custom typeface cache. */
type FontManager = {
	manager: NativeJavaReference;
	lookup: string;
	customTypefaces: NativeJavaReference | undefined;
};

function typefaceLookup(description: Description): string | undefined {
	return description.methods.find(
		(method) =>
			!method.static &&
			method.returnType === TYPEFACE &&
			method.parameters.length === 3 &&
			method.parameters[0] === 'java.lang.String' &&
			method.parameters[2] === ASSETS,
	)?.name;
}

async function findFontManager(java: NativeJavaBridge): Promise<FontManager | undefined> {
	const names = await java.findClasses({
		methods: [{ returns: TYPEFACE, static: false }],
		fields: [{ type: CACHE }],
		limit: MAX_CANDIDATES,
	});

	for (const name of names) {
		const description = java.describe(name);
		const lookup = typefaceLookup(description);
		const self = description.fields.find((field) => field.static && field.type === name);
		const caches = description.fields.filter((field) => !field.static && field.type === CACHE);

		if (!lookup || !self || caches.length < 2) continue;

		const manager = javaReference(java.getField(java.getClass(name), self.name));

		if (!manager) return undefined;

		return {
			manager,
			lookup,
			customTypefaces: javaReference(java.getField(manager, caches[1]!.name)) ?? undefined,
		};
	}

	return undefined;
}

async function findCustomTypefaces(
	java: NativeJavaBridge,
): Promise<NativeJavaReference | undefined> {
	return (await findFontManager(java))?.customTypefaces;
}

/**
 * @description Loads a font family the way React Native text does, so native code can measure text in it.
 * @param java The plugin's Java bridge.
 * @param family The family, such as `ggsans-Normal`.
 * @param assets The app's `AssetManager`, which holds Discord's bundled fonts.
 * @returns The typeface, or `undefined` when React Native's font manager is not found.
 */
export async function reactTypeface(
	java: NativeJavaBridge,
	family: string,
	assets: NativeJavaReference,
): Promise<NativeJavaReference | undefined> {
	const fonts = await findFontManager(java);

	if (!fonts) return undefined;

	return (
		javaReference(
			java.invoke(fonts.manager, fonts.lookup, [javaString(family), javaInt(0), assets]),
		) ?? undefined
	);
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
