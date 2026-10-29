import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';

import { viewKey } from './view-key';

// UNKNOWN: `windows` comes back as a JS array or an `NSArray` handle.
function handles(objc: NativeObjCBridge, value: unknown): NativeObjectHandle[] {
	if (Array.isArray(value)) {
		return value;
	}

	if (!value || typeof value !== 'object') {
		return [];
	}

	return objc.array(value as NativeObjectHandle) as NativeObjectHandle[];
}

// Records a key, reporting whether it is new; an unkeyable view always counts as new.
function once(seen: Set<string>, key: string | undefined): boolean {
	if (key === undefined) {
		return true;
	}

	if (seen.has(key)) {
		return false;
	}

	seen.add(key);

	return true;
}

/**
 * @description Finds the cells of a class on screen in every window, for cells that appeared before a plugin hooked them.
 * @param objc The Objective-C bridge from `context.native`.
 * @param className The cell class, such as `DCDMessageTableViewCell`.
 * @param signal Aborts the scan between native calls, when a newer scan or `stop` supersedes it.
 * @param limits How deep and how many views to search in each window, for views nested deeper than cells.
 * @returns Each visible cell once, or `[]` when the scan was aborted or a window went away mid-scan.
 */
export async function findVisibleCells(
	objc: NativeObjCBridge,
	className: string,
	signal?: AbortSignal,
	limits: { maxDepth?: number; maxVisited?: number } = {},
): Promise<NativeObjectHandle[]> {
	const UIApplication = objc.getClass('UIApplication');

	if (!UIApplication) {
		return [];
	}

	try {
		const [, windowList, keyWindow] = await objc.batch([
			{ target: UIApplication, selector: 'sharedApplication', args: [] },
			{ target: { $nativeBatchResult: 0 }, selector: 'windows', args: [] },
			{ target: { $nativeBatchResult: 0 }, selector: 'keyWindow', args: [] },
		]);
		const windows = handles(objc, windowList);

		if (keyWindow) {
			windows.push(keyWindow as NativeObjectHandle);
		}

		const cells: NativeObjectHandle[] = [];
		const seen = new Set<string>();

		for (const window of windows) {
			if (signal?.aborted) {
				return [];
			}

			// The key window is usually in `windows` too.
			if (!once(seen, viewKey(objc, window))) {
				continue;
			}

			const found = await objc.findViews(window, className, {
				maxDepth: limits.maxDepth ?? 40,
				maxVisited: limits.maxVisited ?? 1_600,
				maxResults: 256,
				attachedOnly: true,
				stopAtMatch: true,
			});

			cells.push(...found.filter((cell) => once(seen, viewKey(objc, cell))));
		}

		return signal?.aborted ? [] : cells;
	} catch {
		return [];
	}
}

export default findVisibleCells;
