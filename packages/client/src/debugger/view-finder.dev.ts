import type {
	ViewFrame,
	ViewNode,
	ViewsRequest,
	ViewsResult,
} from '@unbound-app/debugger-protocol';
import { createLogger } from '@unbound-app/logger';

import { createAndroidViewSource } from '~/debugger/view-finder-android.dev';
import { createIosViewSource } from '~/debugger/view-finder-ios.dev';
import { getNativePlugin } from '~/native/plugin-bridge';
import { currentPlatform } from '~/native/platform';

/** What to outline: a listed view's id, a window rectangle in dp (Android) or points (iOS), or nothing. */
export type OutlineTarget = string | ViewFrame | null;

/** One platform's native view tree, read a level at a time, with an on-screen outline. */
export type ViewSource = {
	/** Lists the children of a view by id, or the root views when `parent` is omitted, which resets every id. */
	list(parent?: string): Promise<ViewNode[]>;
	/** Outlines a view or a window rectangle on screen, or clears the outline when `null`. */
	highlight(target: OutlineTarget): Promise<void>;
	/** Clears the outline and drops every view handle. */
	reset(): Promise<void>;
};

const Logger = createLogger('Debugger', 'ViewFinder');

let source: ViewSource | undefined;
let wanted: OutlineTarget = null;
let shown: OutlineTarget = null;
let draining = false;

function resolveSource(): ViewSource {
	if (source) {
		return source;
	}

	const bridge = getNativePlugin();
	const platform = currentPlatform();

	if (platform === 'android' && bridge?.java) {
		source = createAndroidViewSource(bridge.java);
	} else if (platform === 'ios' && bridge?.objc) {
		source = createIosViewSource(bridge.objc);
	} else {
		throw new Error(`The loader has no native view access on ${platform ?? 'this platform'}.`);
	}

	return source;
}

/**
 * @description Answers a view finder request with one level of the native view tree.
 * @param request The controller's request.
 * @returns The result frame to send back.
 */
export async function listViews(request: ViewsRequest): Promise<ViewsResult> {
	try {
		const nodes = await resolveSource().list(request.parent);

		if (request.parent === undefined) {
			shown = null;
		}

		return { type: 'views-result', id: request.id, ok: true, nodes };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);

		return { type: 'views-result', id: request.id, ok: false, error: message };
	}
}

/**
 * @description Outlines a view on screen. Hovering sends these faster than the main thread draws them, so only the latest is drawn.
 * @param node The view's id, or `null` to clear the outline.
 */
export function highlightView(node: string | null) {
	outline(node);
}

/**
 * @description Outlines a window rectangle on screen, as React DevTools does for a highlighted component.
 * @param frame The rectangle in dp (Android) or points (iOS), or `null` to clear the outline.
 */
export function outlineFrame(frame: ViewFrame | null) {
	outline(frame);
}

function outline(target: OutlineTarget) {
	wanted = target;

	if (!draining) {
		void drain();
	}
}

async function drain() {
	draining = true;

	while (wanted !== shown) {
		const next = wanted;

		try {
			await resolveSource().highlight(next);
		} catch (error) {
			Logger.error(`Failed to outline ${JSON.stringify(next)}:`, error);
		}

		shown = next;
	}

	draining = false;
}

/** Clears the outline and frees every view handle, when the debugger stops. */
export function resetViewFinder() {
	wanted = null;
	shown = null;
	void source?.reset().catch((error) => Logger.error('Failed to reset the view finder:', error));
	source = undefined;
}

export default { listViews, highlightView, outlineFrame, resetViewFinder };
