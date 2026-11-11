import type {
	LoaderObjCBridge,
	NativeObjCResult,
	NativeObjectHandle,
	NativeViewSnapshotNode,
} from '@unbound-app/types';
import type { ViewNode } from '@unbound-app/debugger-protocol';

import type { OutlineTarget, ViewSource } from '~/debugger/view-finder.dev';
import { clipText, type PixelRect } from '~/debugger/view-node.dev';

type Entry = { view: NativeObjectHandle; rect: PixelRect };
type Border = { layer: NativeObjectHandle; width: NativeObjCResult; color: NativeObjCResult };

const OUTLINE_WIDTH = 2;

/**
 * @description Reads the visible windows' UIView trees one level at a time, and outlines a view with its layer border.
 * @param objc The loader's unscoped Objective-C bridge.
 * @returns The iOS view source.
 */
export function createIosViewSource(objc: LoaderObjCBridge): ViewSource {
	const entries = new Map<string, Entry>();
	let nextId = 0;
	let saved: Border | undefined;

	function describe(
		view: NativeObjectHandle,
		node: NativeViewSnapshotNode,
		rect: PixelRect,
		childCount: number,
	): ViewNode {
		const id = String(++nextId);
		const identifier = objc.call(view, 'accessibilityIdentifier');
		const alpha = objc.call(view, 'alpha');

		entries.set(id, { view, rect });

		return {
			id,
			className: node.className,
			resourceName: typeof identifier === 'string' && identifier ? identifier : null,
			frame: rect,
			visibility: node.visible ? 'visible' : 'invisible',
			alpha: typeof alpha === 'number' ? alpha : null,
			text: node.text ? clipText(node.text) : null,
			childCount,
		};
	}

	// Two levels: the view's children, and theirs only to count them.
	async function level(view: NativeObjectHandle) {
		const nodes = await objc.snapshot(view, { maxDepth: 2, maxNodes: 256 });
		const counts = new Map<number, number>();

		for (const node of nodes) counts.set(node.parent, (counts.get(node.parent) ?? 0) + 1);

		return { nodes, counts };
	}

	async function roots(): Promise<ViewNode[]> {
		await reset();

		const application = objc.getClass('UIApplication');
		const shared = application ? objc.call(application, 'sharedApplication') : undefined;
		const list = shared ? objc.call(shared as NativeObjectHandle, 'windows') : undefined;
		const windows = (
			list ? objc.array(list as NativeObjectHandle) : []
		) as NativeObjectHandle[];
		const visible = windows.filter((window) => objc.call(window, 'isHidden') !== true);
		const nodes: ViewNode[] = [];

		for (const window of visible) {
			const { nodes: snapshot, counts } = await level(window);
			const root = snapshot[0];

			if (root) {
				nodes.push(describe(window, root, root.frame, counts.get(0) ?? 0));
			}
		}

		return nodes;
	}

	async function children(id: string): Promise<ViewNode[]> {
		const parent = entries.get(id);

		if (!parent) {
			throw new Error(`Failed to find view ${id}; refresh the tree.`);
		}

		const { nodes, counts } = await level(parent.view);

		return nodes.flatMap((node, index) => {
			if (node.parent !== 0) {
				return [];
			}

			const rect = {
				x: parent.rect.x + node.frame.x,
				y: parent.rect.y + node.frame.y,
				width: node.frame.width,
				height: node.frame.height,
			};

			return [describe(node.view, node, rect, counts.get(index) ?? 0)];
		});
	}

	async function clearOutline() {
		if (!saved) return;

		const { layer, width, color } = saved;

		saved = undefined;
		await objc.invokeAsync(layer, 'setBorderWidth:', [width]);
		await objc.invokeAsync(layer, 'setBorderColor:', [color]);
	}

	// Only listed views are outlined; a bare frame, as React DevTools sends, has no layer to border on iOS yet.
	async function highlight(target: OutlineTarget) {
		await clearOutline();

		const entry = typeof target === 'string' ? entries.get(target) : undefined;
		const layer = entry ? (objc.call(entry.view, 'layer') as NativeObjectHandle | null) : null;
		const palette = objc.getClass('UIColor');

		if (!layer || !palette) return;

		const color = objc.call(palette, 'systemTealColor') as NativeObjectHandle;

		saved = {
			layer,
			width: objc.call(layer, 'borderWidth'),
			color: objc.call(layer, 'borderColor'),
		};
		await objc.invokeAsync(layer, 'setBorderWidth:', [OUTLINE_WIDTH]);
		await objc.invokeAsync(layer, 'setBorderColor:', [objc.invoke(color, 'CGColor', [])]);
	}

	async function reset() {
		await clearOutline();
		entries.clear();
	}

	return {
		list: (parent) => (parent === undefined ? roots() : children(parent)),
		highlight,
		reset,
	};
}

export default { createIosViewSource };
