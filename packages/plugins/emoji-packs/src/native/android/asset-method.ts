import type { NativeJavaBridge } from '@unbound-app/api/native';
import { javaString, javaText } from '@unbound-plugins/shared/native/android/java-values';

const PROBE = '😀';
const PROBE_URL = 'asset:///emoji-1f600.png';
const OBFUSCATED_CLASS = /^[a-z]{1,3}\.[a-zA-Z0-9]{1,4}$/;

/** The static method that turns a unicode emoji into Discord's bundled image URL. */
export type AssetMethod = { className: string; method: string };

function candidates(java: NativeJavaBridge, className: string): string[] {
	try {
		return java
			.describe(className)
			.methods.filter(
				(method) =>
					method.static &&
					method.returnType === 'java.lang.String' &&
					method.parameters.length === 1 &&
					method.parameters[0] === 'java.lang.String',
			)
			.map((method) => method.name);
	} catch {
		return [];
	}
}

function answers(java: NativeJavaBridge, className: string, method: string): boolean {
	try {
		const owner = java.getClass(className);
		const result = javaText(java.invoke(owner, method, [javaString(PROBE)]));

		return result === PROBE_URL;
	} catch {
		return false;
	}
}

/**
 * @description Finds the static method Discord's emoji picker builds `asset:///emoji-<codepoints>.png` with. Its class
 * and name are obfuscated, so each candidate of the right shape in Discord's own packages is asked for 😀's URL.
 * @param java The plugin's Java bridge.
 * @returns The method, or `undefined` when no candidate answers.
 */
export async function findAssetMethod(java: NativeJavaBridge): Promise<AssetMethod | undefined> {
	const classes = await java.findClasses({
		methods: [{ parameters: ['java.lang.String'], returns: 'java.lang.String', static: true }],
		limit: 1000,
	});

	for (const className of classes.filter((name) => OBFUSCATED_CLASS.test(name))) {
		const method = candidates(java, className).find((name) => answers(java, className, name));

		if (method) return { className, method };
	}

	return undefined;
}
