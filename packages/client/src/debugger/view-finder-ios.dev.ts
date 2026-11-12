import type {
	LoaderObjCBridge,
	NativeBatchStep,
	NativeObjCResult,
	NativeObjectHandle,
} from '@unbound-app/types';
import type { ViewFrame, ViewNode } from '@unbound-app/debugger-protocol';

import type { OutlineTarget, ViewLevel, ViewPage, ViewSource } from '~/debugger/view-finder.dev';
import { asNumber, asText, onMainThread } from '~/debugger/objc-values.dev';
import { clipText, type PixelRect } from '~/debugger/view-node.dev';
import { readIosDetails } from '~/debugger/view-details-ios.dev';

type Entry = { view: NativeObjectHandle; rect: PixelRect };
type Border = { layer: NativeObjectHandle; width: NativeObjCResult; color: NativeObjCResult };
type Listed = {
	view: NativeObjectHandle;
	className: string;
	frame: PixelRect;
	text: string | null;
	visible: boolean;
};

const OUTLINE_WIDTH = 2;
const FILL_ALPHA = 0.2;
/** `objc.snapshot` returns at most 256 views, the root among them, so a level reads its first 255 children. */
const SNAPSHOT_CHILDREN = 255;
/** What a listing reads about each view, on the main thread, after the snapshot. */
const VIEW_STEPS = 4;

/**
 * @description Reads the visible windows' UIView trees a page of one level at a time, on the main thread, and outlines
 * a view with its layer border or a window rectangle with an overlay view.
 * @param objc The loader's unscoped Objective-C bridge.
 * @returns The iOS view source.
 */
export function createIosViewSource(objc: LoaderObjCBridge): ViewSource {
	const entries = new Map<string, Entry>();
	let nextId = 0;
	let saved: Border | undefined;
	let overlay: NativeObjectHandle | undefined;
	let overlaid = false;

	/** Reads each view's subview count, alpha and accessibility identifier in batches on the main thread. */
	async function describeAll(
		listed: Listed[],
		origin: { x: number; y: number },
	): Promise<ViewNode[]> {
		const steps = listed.flatMap(({ view }, index): NativeBatchStep[] => {
			const base = index * VIEW_STEPS;

			return [
				{ target: view, selector: 'subviews', args: [] },
				{ target: { $nativeBatchResult: base }, selector: 'count', args: [] },
				{ target: view, selector: 'alpha', args: [] },
				{ target: view, selector: 'accessibilityIdentifier', args: [] },
			];
		});
		const results = await onMainThread(objc, steps, VIEW_STEPS);

		return listed.map((node, index) => {
			const base = index * VIEW_STEPS;
			const id = String(++nextId);
			const rect = {
				x: origin.x + node.frame.x,
				y: origin.y + node.frame.y,
				width: node.frame.width,
				height: node.frame.height,
			};

			entries.set(id, { view: node.view, rect });

			return {
				id,
				className: node.className,
				resourceName: asText(results[base + 3]) || null,
				frame: rect,
				visibility: node.visible ? 'visible' : 'invisible',
				alpha: asNumber(results[base + 2]) ?? null,
				text: node.text ? clipText(node.text) : null,
				childCount: Math.min(asNumber(results[base + 1]) ?? 0, SNAPSHOT_CHILDREN),
			};
		});
	}

	async function roots({ offset, limit }: ViewPage): Promise<ViewLevel> {
		await reset();

		const application = objc.getClass('UIApplication');
		const shared = application ? objc.call(application, 'sharedApplication') : undefined;
		const list = shared ? objc.call(shared as NativeObjectHandle, 'windows') : undefined;
		const windows = (
			list ? objc.array(list as NativeObjectHandle) : []
		) as NativeObjectHandle[];
		const visible = windows.filter((window) => objc.call(window, 'isHidden') !== true);
		const page = visible.slice(offset, offset + limit);
		const listed: Listed[] = [];

		for (const window of page) {
			const [root] = await objc.snapshot(window, { maxDepth: 0, maxNodes: 1 });

			if (root) {
				listed.push({ ...root, view: window });
			}
		}

		return { nodes: await describeAll(listed, { x: 0, y: 0 }), total: visible.length };
	}

	async function children(id: string, { offset, limit }: ViewPage): Promise<ViewLevel> {
		const parent = entries.get(id);

		if (!parent) {
			throw new Error(`Failed to find view ${id}; refresh the tree.`);
		}

		const end = Math.min(offset + limit, SNAPSHOT_CHILDREN);
		const nodes = await objc.snapshot(parent.view, { maxDepth: 1, maxNodes: end + 1 });
		const level = nodes.filter((node) => node.parent === 0);
		const [, count] = await objc.batch([
			{ target: parent.view, selector: 'subviews', args: [] },
			{ target: { $nativeBatchResult: 0 }, selector: 'count', args: [] },
		]);
		const total = Math.min(asNumber(count) ?? level.length, SNAPSHOT_CHILDREN);

		return { nodes: await describeAll(level.slice(offset, end), parent.rect), total };
	}

	async function details(id: string) {
		const entry = entries.get(id);

		if (!entry) {
			throw new Error(`Failed to find view ${id}; refresh the tree.`);
		}

		return await readIosDetails(objc, entry.view);
	}

	async function clearOutline() {
		if (overlaid && overlay) {
			overlaid = false;
			await objc.invokeAsync(overlay, 'removeFromSuperview', []);
		}

		if (!saved) return;

		const { layer, width, color } = saved;

		saved = undefined;
		await objc.invokeAsync(layer, 'setBorderWidth:', [width]);
		await objc.invokeAsync(layer, 'setBorderColor:', [color]);
	}

	/** A teal, untouchable view, made once and moved for each rectangle React DevTools highlights. */
	async function prepareOverlay(): Promise<NativeObjectHandle | undefined> {
		if (overlay) {
			return overlay;
		}

		const viewClass = objc.getClass('UIView');
		const palette = objc.getClass('UIColor');
		const view = viewClass ? (objc.call(viewClass, 'new') as NativeObjectHandle | null) : null;

		if (!view || !palette) {
			return undefined;
		}

		const teal = objc.call(palette, 'systemTealColor') as NativeObjectHandle;
		const fill = objc.invoke(teal, 'colorWithAlphaComponent:', [FILL_ALPHA]);
		const layer = objc.call(view, 'layer') as NativeObjectHandle;

		await objc.invokeAsync(view, 'setUserInteractionEnabled:', [false]);
		await objc.invokeAsync(view, 'setBackgroundColor:', [fill]);
		await objc.invokeAsync(layer, 'setBorderWidth:', [OUTLINE_WIDTH]);
		await objc.invokeAsync(layer, 'setBorderColor:', [objc.invoke(teal, 'CGColor', [])]);
		overlay = view;

		return view;
	}

	// The key window spans the screen, so its coordinates are the points React Native measures in.
	async function outlineFrame({ x, y, width, height }: ViewFrame) {
		const application = objc.getClass('UIApplication');
		const shared = application ? objc.call(application, 'sharedApplication') : undefined;
		const window = shared ? objc.call(shared as NativeObjectHandle, 'keyWindow') : undefined;
		const view = window ? await prepareOverlay() : undefined;

		if (!window || !view) return;

		const rect = objc.struct('CGRect', { origin: { x, y }, size: { width, height } });

		await objc.invokeAsync(view, 'setFrame:', [rect]);
		await objc.invokeAsync(window as NativeObjectHandle, 'addSubview:', [view]);
		overlaid = true;
	}

	async function highlight(target: OutlineTarget) {
		await clearOutline();

		if (target && typeof target === 'object') {
			await outlineFrame(target);

			return;
		}

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
		list: (parent, page) => (parent === undefined ? roots(page) : children(parent, page)),
		details,
		handle: (id) => entries.get(id)?.view,
		highlight,
		reset,
	};
}

export default { createIosViewSource };
