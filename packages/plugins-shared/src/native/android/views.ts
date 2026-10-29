import type {
	NativeJavaBatchOperation,
	NativeJavaBridge,
	NativeJavaReference,
	NativeJavaValue,
} from '@unbound-app/api/native';

import { javaFlag, javaInt, javaNumber, javaReference } from './java-values';

export type ViewBridge = Pick<
	NativeJavaBridge,
	'getClass' | 'invoke' | 'getField' | 'batch' | 'batchAsync' | 'findViews'
>;

const MAX_VISITED = 4_000;
const BATCH_STEPS = 64;
const VIEW_SEARCH = { maxDepth: 128, maxVisited: 8_192, maxResults: 256 };

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
 * @description Runs Java operations on the main thread in batches the bridge accepts, or on the calling thread with a loader that cannot.
 * @param java The plugin's Java bridge.
 * @param operations The operations.
 * @returns Each operation's result, in order.
 */
export async function runOnMain(
	java: ViewBridge,
	operations: NativeJavaBatchOperation[],
): Promise<NativeJavaValue[]> {
	const results: NativeJavaValue[] = [];

	for (let start = 0; start < operations.length; start += BATCH_STEPS) {
		const chunk = operations.slice(start, start + BATCH_STEPS);

		results.push(...(java.batchAsync ? await java.batchAsync(chunk) : java.batch(chunk)));
	}

	return results;
}

function walkOnCallingThread(
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

/**
 * @description Finds the attached views of a class under a root, for views bound before a plugin's hooks were installed. The search runs on the main thread in one call; loaders without it walk the tree on the calling thread.
 * @param java The plugin's Java bridge.
 * @param root The view to search under.
 * @param className The view class, such as `com.discord.chat.presentation.message.MessageView`.
 * @returns Each matching view, in tree order.
 */
export async function findViewsOfClass(
	java: ViewBridge,
	root: NativeJavaReference,
	className: string,
): Promise<NativeJavaReference[]> {
	if (!java.findViews) {
		return walkOnCallingThread(java, root, className);
	}

	const found = await java.findViews(root, className, VIEW_SEARCH);

	return found
		.map((view) => javaReference(view))
		.filter((view): view is NativeJavaReference => !!view);
}

/**
 * @description Scans the views on screen after each startup delay, logging a scan that fails.
 * @param label The plugin's name for the log.
 * @param scan Finds and handles the views on screen.
 * @returns The timers, to clear when the plugin stops.
 */
export function scheduleStartupScans(
	label: string,
	scan: () => Promise<void>,
): ReturnType<typeof setTimeout>[] {
	return STARTUP_SCAN_DELAYS.map((delay) =>
		setTimeout(() => {
			scan().catch((error) =>
				console.error(`[${label}] Failed to scan the views on screen:`, error),
			);
		}, delay),
	);
}

export default {
	currentActivity,
	currentDecorView,
	findViewsOfClass,
	runOnMain,
	scheduleStartupScans,
};
