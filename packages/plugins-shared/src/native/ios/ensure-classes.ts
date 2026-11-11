import type { NativeObjCBridge } from '@unbound-app/api/native';

/**
 * @description Checks that every Objective-C class a plugin hooks or allocates exists, so `start` can bail out before applying a partial feature.
 * @param objc The Objective-C bridge from `context.native`.
 * @param classes The class names to check.
 * @param feature The feature that needs them, named in the warning; `Plugin` when omitted.
 * @returns `true` when every class exists, otherwise `false` after one warning naming the missing ones.
 */
export function ensureClasses(
	objc: NativeObjCBridge,
	classes: string[],
	feature = 'Plugin',
): boolean {
	const missing = classes.filter((name) => !objc.getClass(name));

	if (missing.length) {
		logger.warn(`${feature} skipped: native classes not found: ${missing.join(', ')}.`);
	}

	return !missing.length;
}

export default ensureClasses;
