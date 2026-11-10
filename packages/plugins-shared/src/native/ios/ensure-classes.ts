import { ensurePresent } from '@unbound-plugins/shared/lifecycle/features';
import type { NativeObjCBridge } from '@unbound-app/api/native';

/**
 * @description Checks that every Objective-C class a plugin hooks or allocates exists, so `start` can bail out before applying a partial feature.
 * @param objc The Objective-C bridge from `context.native`.
 * @param classes The class names to check.
 * @param feature The feature that needs them, when not the whole plugin, named in the log line.
 * @returns `true` when every class exists, otherwise `false` after logging the missing names.
 */
export function ensureClasses(
	objc: NativeObjCBridge,
	classes: string[],
	feature?: string,
): boolean {
	const missing = classes.filter((name) => !objc.getClass(name));

	return ensurePresent(missing, 'native classes not found', feature);
}

export default ensureClasses;
