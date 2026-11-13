import type {
	ViewDetails,
	ViewDetailsRequest,
	ViewDetailsResult,
	ViewFrame,
	ViewNode,
	ViewsRequest,
	ViewsResult,
} from '@unbound-app/debugger-protocol';
import { VIEWS_PAGE_SIZE } from '@unbound-app/debugger-protocol';
import { createLogger } from '@unbound-app/logger';

import { createAndroidViewSource } from '~/debugger/view-finder-android.dev';
import type { ExplorerHandle } from '~/debugger/explorer-objects.dev';
import { createIosViewSource } from '~/debugger/view-finder-ios.dev';
import { currentPlatform } from '~/native/platform';
import { getNativeBridge } from '~/native/bridge';

/** What to outline: a listed view's id, a window rectangle in dp (Android) or points (iOS), or nothing. */
export type OutlineTarget = string | ViewFrame | null;

/** The children of one view from `offset`, at most `limit` of them. */
export type ViewPage = { offset: number; limit: number };

/** One page of a level, and how many views the level holds in all. */
export type ViewLevel = { nodes: ViewNode[]; total: number };

/** One platform's native view tree, read a page of a level at a time, with an on-screen outline. */
export type ViewSource = {
	/** Lists a page of the children of a view by id, or the root views when `parent` is omitted, which resets every id. */
	list(parent: string | undefined, page: ViewPage): Promise<ViewLevel>;
	/** Reads a listed view's class chain and properties. */
	details(id: string): Promise<ViewDetails>;
	/** The native handle of a listed view, for the object explorer, or `undefined` once its id is renewed. */
	handle(id: string): ExplorerHandle | undefined;
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

	const bridge = getNativeBridge();
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
	const page = {
		offset: Math.max(request.offset ?? 0, 0),
		limit: Math.min(Math.max(request.limit ?? VIEWS_PAGE_SIZE, 0), VIEWS_PAGE_SIZE),
	};

	try {
		const { nodes, total } = await resolveSource().list(request.parent, page);

		if (request.parent === undefined) {
			shown = null;
		}

		return { type: 'views-result', id: request.id, ok: true, nodes, total };
	} catch (error) {
		return { type: 'views-result', id: request.id, ok: false, error: errorText(error) };
	}
}

/**
 * @description Answers a view details request with the view's class chain and properties.
 * @param request The controller's request.
 * @returns The result frame to send back.
 */
export async function describeView(request: ViewDetailsRequest): Promise<ViewDetailsResult> {
	try {
		const details = await resolveSource().details(request.node);

		return { type: 'view-details-result', id: request.id, ok: true, details };
	} catch (error) {
		Logger.error(`Failed to read view ${request.node}:`, error);

		return { type: 'view-details-result', id: request.id, ok: false, error: errorText(error) };
	}
}

/**
 * @description Finds a listed view's native handle, so the object explorer can open it.
 * @param node The view's id.
 * @returns The handle, or `undefined` when nothing is listed under the id.
 */
export function viewHandle(node: string): ExplorerHandle | undefined {
	return source?.handle(node);
}

// UNKNOWN: a catch clause can receive any thrown value.
function errorText(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
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

export default {
	listViews,
	describeView,
	viewHandle,
	highlightView,
	outlineFrame,
	resetViewFinder,
};
