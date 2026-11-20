const DEV_NATIVE_GLOBAL = '__unboundDevNative';
const DEV_INSPECTOR_GLOBAL = '__unboundDevInspector';

/**
 * @description Prefixes eval code with a `native` variable bound to the development build's session native bridge, and an
 * `inspector` variable for the Objective-C inspector (`inspectClass`, `inspectMembers`, ...) on iOS.
 * @param code The code to evaluate.
 * @returns The code, which throws a clear error on a build without the development bridge.
 */
export function withNativeBridge(code: string): string {
	return [
		`var native = typeof globalThis.${DEV_NATIVE_GLOBAL} === 'function'`,
		`\t? globalThis.${DEV_NATIVE_GLOBAL}()`,
		`\t: (() => { throw new Error('This build has no development native bridge; use a development build of Unbound.'); })();`,
		`var inspector = typeof globalThis.${DEV_INSPECTOR_GLOBAL} === 'function' ? globalThis.${DEV_INSPECTOR_GLOBAL}() : undefined;`,
		code,
	].join('\n');
}

export default { withNativeBridge };
