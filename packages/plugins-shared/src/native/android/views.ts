import type { NativeJavaBridge, NativeJavaReference } from '@unbound-app/api/native';

import { javaFlag, javaInt, javaNumber, javaReference } from './java-values';

export type ViewBridge = Pick<NativeJavaBridge, 'getClass' | 'invoke' | 'getField'>;

const MAX_VISITED = 4_000;

export const STARTUP_SCAN_DELAYS = [300];

/**
 * @description Reads the activity the loader's `ActivityTracker` saw resume last.
 * @param java The plugin's Java bridge.
 * @returns The activity, or `null` while no activity is resumed.
 */
export function currentActivity(java: ViewBridge): NativeJavaReference | null {
	const tracker = javaReference(
		java.getField(java.getClass('app.unbound.android.ActivityTracker'), 'INSTANCE'),
	);

	return tracker ? javaReference(java.invoke(tracker, 'currentActivity', [])) : null;
}

/**
 * @description Reads the decor view of the activity the loader saw resume last.
 * @param java The plugin's Java bridge.
 * @returns The decor view, or `null` while no activity is resumed.
 */
export function currentDecorView(java: ViewBridge): NativeJavaReference | null {
	const activity = currentActivity(java);
	const window = activity ? javaReference(java.invoke(activity, 'getWindow', [])) : null;

	return window ? javaReference(java.invoke(window, 'getDecorView', [])) : null;
}

/**
 * @description Finds the attached views of a class under a root, for views bound before a plugin's hooks were installed.
 * @param java The plugin's Java bridge.
 * @param root The view to search under.
 * @param className The view class, such as `com.discord.chat.presentation.message.MessageView`.
 * @returns Each matching view, in tree order.
 */
export function findViewsOfClass(
	java: ViewBridge,
	root: NativeJavaReference,
	className: string,
): NativeJavaReference[] {
	const target = java.getClass(className);
	const group = java.getClass('android.view.ViewGroup');
	const found: NativeJavaReference[] = [];
	const queue: NativeJavaReference[] = [root];

	for (let visited = 0; queue.length && visited < MAX_VISITED; visited++) {
		const view = queue.shift()!;

		if (javaFlag(java.invoke(target, 'isInstance', [view]))) {
			found.push(view);
		}

		if (!javaFlag(java.invoke(group, 'isInstance', [view]))) {
			continue;
		}

		const count = javaNumber(java.invoke(view, 'getChildCount', [])) ?? 0;

		for (let index = 0; index < count; index++) {
			const child = javaReference(java.invoke(view, 'getChildAt', [javaInt(index)]));

			if (child) {
				queue.push(child);
			}
		}
	}

	return found;
}

export default { currentActivity, currentDecorView, findViewsOfClass };
