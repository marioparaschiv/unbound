import type { NativeObjCBridge } from '@unbound-app/api/native';

import { recordSkip } from '../lifecycle/health';

/**
 * @description Checks that every Objective-C class a plugin hooks or allocates exists, so `start` can bail out before applying a partial feature.
 * @param plugin The plugin's display name, used in the log line.
 * @param objc The Objective-C bridge from `context.native`.
 * @param classes The class names to check.
 * @returns `true` when every class exists, otherwise `false` after logging the missing names.
 */
export function ensureClasses(plugin: string, objc: NativeObjCBridge, classes: string[]): boolean {
	const missing = classes.filter((name) => !objc.getClass(name));

	if (!missing.length) {
		return true;
	}

	recordSkip(`${plugin}: native classes not found: ${missing.join(', ')}`);
	console.error(`[${plugin}] Not starting, native classes not found: ${missing.join(', ')}.`);

	return false;
}

export default ensureClasses;
