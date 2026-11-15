import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';

const USAGE_SUFFIX = 'UsageDescription';

type InfoBridge = Pick<NativeObjCBridge, 'getClass' | 'call' | 'invoke'>;

function mainBundle(objc: InfoBridge): NativeObjectHandle | undefined {
	const bundleClass = objc.getClass('NSBundle');

	if (!bundleClass) return undefined;

	return objc.call(bundleClass, 'mainBundle') as NativeObjectHandle;
}

function infoDictionary(objc: InfoBridge): Record<string, unknown> {
	const bundle = mainBundle(objc);
	const info = bundle && objc.invoke(bundle, 'infoDictionary', []);

	return info && typeof info === 'object' ? (info as Record<string, unknown>) : {};
}

/**
 * @description Lists the privacy usage keys, such as `NSCameraUsageDescription`, that this install's Info.plist declares.
 * @param objc The Objective-C bridge from `context.native`.
 * @returns The declared keys, sorted.
 */
export function declaredUsageKeys(objc: InfoBridge): string[] {
	return Object.entries(infoDictionary(objc))
		.filter(([key, value]) => key.endsWith(USAGE_SUFFIX) && typeof value === 'string')
		.map(([key]) => key)
		.sort();
}

/**
 * @description Checks whether this install's Info.plist declares a privacy usage key, which iOS requires before asking for that permission.
 * @param objc The Objective-C bridge from `context.native`.
 * @param key The usage key, such as `NSSpeechRecognitionUsageDescription`.
 * @returns `true` when the key is declared with a description.
 */
export function declaresUsage(objc: InfoBridge, key: string): boolean {
	return declaredUsageKeys(objc).includes(key);
}
