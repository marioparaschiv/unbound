const DEV_NATIVE_GLOBAL = '__unboundDevNative';

/**
 * @description Prefixes eval code with a `native` variable bound to the development build's session native bridge.
 * @param code The code to evaluate.
 * @returns The code, which throws a clear error on a build without the development bridge.
 */
export function withNativeBridge(code: string): string {
	return [
		`var native = typeof globalThis.${DEV_NATIVE_GLOBAL} === 'function'`,
		`\t? globalThis.${DEV_NATIVE_GLOBAL}()`,
		`\t: (() => { throw new Error('This build has no development native bridge; use a development build of Unbound.'); })();`,
		code,
	].join('\n');
}

export default { withNativeBridge };
