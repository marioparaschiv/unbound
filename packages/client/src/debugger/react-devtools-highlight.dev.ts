import type { ViewFrame } from '@unbound-app/debugger-protocol';
import { createLogger } from '@unbound-app/logger';

import { outlineFrame } from '~/debugger/view-finder.dev';
import { unionFrames } from '~/debugger/view-node.dev';

/** `measure`'s callback: the offset in the parent, the size, then the position on the page. */
type MeasureCallback = (
	x: number,
	y: number,
	width: number,
	height: number,
	pageX: number,
	pageY: number,
) => void;

declare const fabricNode: unique symbol;

/** Fabric's opaque shadow node, which only the UI manager reads; the brand keeps other values out. */
type FabricNode = { readonly [fabricNode]: true };

/** What the agent highlights: Fabric's `{ node, canonical }` instances, or legacy components that measure themselves. */
type HostInstance = {
	node?: FabricNode;
	measure?: (callback: MeasureCallback) => void;
};

/** `showNativeHighlight` passes the host instances; `hideNativeHighlight` passes nothing. */
type HighlightListener = (elements?: HostInstance[]) => void;

/** The React DevTools backend's agent, as far as its native highlight events go. */
type Agent = {
	addListener(event: string, listener: HighlightListener): void;
	removeListener(event: string, listener: HighlightListener): void;
};

declare global {
	/** Installed by the React DevTools backend; holds the agent while a session runs. */
	var __REACT_DEVTOOLS_GLOBAL_HOOK__: { reactDevtoolsAgent?: Agent | null } | undefined;
	/** React Native's Fabric UI manager. */
	var nativeFabricUIManager:
		| { measure?: (node: FabricNode, callback: MeasureCallback) => void }
		| undefined;
}

const Logger = createLogger('Debugger', 'ReactDevTools');

// A release build never mounts React Native's DebuggingOverlay, so nothing else answers the agent's highlight events.
const SHOW_EVENT = 'showNativeHighlight';
const HIDE_EVENT = 'hideNativeHighlight';

/**
 * @description Draws React DevTools' component highlights with the view finder's outline, for the running session's agent.
 * @returns Stops drawing them and clears the outline.
 */
export function watchHighlights(): () => void {
	const agent = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__?.reactDevtoolsAgent;

	if (!agent) {
		Logger.warn('Failed to find the React DevTools agent; component highlights stay off.');

		return () => outlineFrame(null);
	}

	const show: HighlightListener = (elements = []) => void outlineElements(elements);
	const hide = () => outlineFrame(null);

	agent.addListener(SHOW_EVENT, show);
	agent.addListener(HIDE_EVENT, hide);

	return () => {
		agent.removeListener(SHOW_EVENT, show);
		agent.removeListener(HIDE_EVENT, hide);
		outlineFrame(null);
	};
}

async function outlineElements(elements: HostInstance[]) {
	const frames = await Promise.all(elements.map(measure));

	outlineFrame(unionFrames(frames.filter((frame) => frame !== undefined)) ?? null);
}

function measure(element: HostInstance): Promise<ViewFrame | undefined> {
	return new Promise((resolve) => {
		// On Android `measureInWindow` lands ~50dp above the view; the page position matches the decor view's overlay.
		const done: MeasureCallback = (_x, _y, width, height, x, y) =>
			resolve({ x, y, width, height });
		const fabric = globalThis.nativeFabricUIManager?.measure;

		if (element.node && fabric) {
			fabric(element.node, done);
		} else if (element.measure) {
			element.measure(done);
		} else {
			resolve(undefined);
		}
	});
}

export default { watchHighlights };
