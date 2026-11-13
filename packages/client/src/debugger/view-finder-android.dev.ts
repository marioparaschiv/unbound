import type {
	NativeJavaArgument,
	NativeJavaBridge,
	NativeJavaCallPlan,
	NativeJavaHandleValue,
	NativeJavaValue,
} from '@unbound-app/types';
import type { ViewNode } from '@unbound-app/debugger-protocol';

import {
	androidVisibility,
	clipText,
	isResourceId,
	placeChild,
	toDp,
	toPixels,
	type PixelRect,
} from '~/debugger/view-node.dev';
import {
	byName,
	calls,
	handle,
	int,
	isTrue,
	number,
	onMain,
	string,
} from '~/debugger/java-values.dev';
import type { OutlineTarget, ViewPage, ViewSource } from '~/debugger/view-finder.dev';
import { readAndroidDetails } from '~/debugger/view-details-android.dev';
import { explorerObjects } from '~/debugger/explorer-objects.dev';

type Entry = { view: NativeJavaHandleValue; rect: PixelRect };

/** What a listing reads about each child, on the main thread in one batch per 64 calls. */
const CHILD_CALLS = ['getX', 'getY', 'getWidth', 'getHeight', 'getVisibility', 'getAlpha', 'getId'];

// React DevTools' highlight blue: a translucent fill under a solid outline.
const FILL_COLOR = 0x5561dafb;
const STROKE_COLOR = 0xff61dafb | 0;
const STROKE_WIDTH_PX = 4;

/**
 * @description Reads the current activity's Android view tree a page of one level at a time, reading views only on the
 * main thread, and outlines a view in the decor view's overlay.
 * @param java The loader's unscoped Java bridge.
 * @returns The Android view source.
 */
export function createAndroidViewSource(java: NativeJavaBridge): ViewSource {
	const entries = new Map<string, Entry>();
	const group = java.getClass('android.view.ViewGroup');
	const textView = java.getClass('android.widget.TextView');
	let decor: NativeJavaHandleValue | undefined;
	let resources: NativeJavaHandleValue | undefined;
	let density = 1;
	let overlay:
		| { handle: NativeJavaHandleValue; add: NativeJavaCallPlan; remove: NativeJavaCallPlan }
		| undefined;
	let drawable: ReturnType<NativeJavaBridge['construct']> | undefined;
	let outlined = false;

	// The bridge counts an explicit `undefined` as an argument list and rejects it, so no-argument calls pass `[]`.
	function invoke(target: NativeJavaHandleValue, name: string, args: NativeJavaArgument[] = []) {
		try {
			return java.invoke(target, name, args);
		} catch {
			// A view can refuse a call, such as a resource lookup for an id it made up; read it as null.
			return { type: 'null' } satisfies NativeJavaValue;
		}
	}

	// Resources are shared by every view in the activity and are not a view, so they are read off the main thread.
	function resourceName(id: number): string | null {
		return isResourceId(id) && resources
			? string(invoke(resources, 'getResourceEntryName', [int(id)])) || null
			: null;
	}

	// A CharSequence is a snapshot of the text, not the view, so it is read off the main thread.
	function textOf(value: NativeJavaValue | undefined): string | null {
		const sequence = handle(value);
		const text = sequence ? string(invoke(sequence, 'toString')) : string(value);

		if (sequence) {
			java.release(sequence);
		}

		return clipText(text);
	}

	/** Reads a page of views in batches on the main thread: geometry and state, then counts and text by class. */
	async function describeAll(
		views: NativeJavaHandleValue[],
		place: (local: PixelRect) => PixelRect,
	): Promise<ViewNode[]> {
		// `isInstance` reads the class, not the view, so it stays on the JavaScript thread.
		const kinds = views.map((view) => ({
			group: isTrue(java.invoke(group, 'isInstance', [view])),
			text: isTrue(java.invoke(textView, 'isInstance', [view])),
		}));
		const operations = views.flatMap((view, index) => [
			...calls(view, CHILD_CALLS),
			...calls(view, kinds[index]?.group ? ['getChildCount'] : []),
			...calls(view, kinds[index]?.text ? ['getText'] : []),
		]);
		const results = await onMain(java, operations);
		let cursor = 0;

		return views.map((view, index) => {
			const kind = kinds[index];
			const read = byName(CHILD_CALLS, results.slice(cursor, cursor + CHILD_CALLS.length));

			cursor += CHILD_CALLS.length;
			const childCount = kind?.group ? number(results[cursor++]) : 0;
			const text = kind?.text ? textOf(results[cursor++]) : null;
			const rect = place({
				x: number(read.get('getX')),
				y: number(read.get('getY')),
				width: number(read.get('getWidth')),
				height: number(read.get('getHeight')),
			});

			entries.set(view.value, { view, rect });

			return {
				id: view.value,
				className: string(java.className(view)),
				resourceName: resourceName(number(read.get('getId'))),
				frame: toDp(rect, density),
				visibility: androidVisibility(number(read.get('getVisibility'))),
				alpha: number(read.get('getAlpha')),
				text,
				childCount,
			};
		});
	}

	/** Finds the resumed activity's decor view and the display density, or throws when no activity is resumed. */
	function attach(): NativeJavaHandleValue {
		if (decor) {
			return decor;
		}

		const tracker = handle(
			java.getField(java.getClass('app.unbound.android.ActivityTracker'), 'INSTANCE'),
		);
		const activity = tracker ? handle(invoke(tracker, 'currentActivity')) : undefined;
		const window = activity ? handle(invoke(activity, 'getWindow')) : undefined;

		const view = window ? handle(invoke(window, 'getDecorView')) : undefined;

		if (!view) {
			throw new Error('No Android activity is resumed.');
		}

		resources = handle(invoke(view, 'getResources'));
		const metrics = resources ? handle(invoke(resources, 'getDisplayMetrics')) : undefined;

		density = metrics ? number(java.getField(metrics, 'density')) || 1 : 1;
		decor = view;

		return view;
	}

	async function roots({ offset }: ViewPage) {
		await reset();

		const root = attach();
		const nodes =
			offset > 0 ? [] : await describeAll([root], (local) => ({ ...local, x: 0, y: 0 }));

		return { nodes, total: 1 };
	}

	async function children(id: string, { offset, limit }: ViewPage) {
		const parent = entries.get(id);

		if (!parent) {
			throw new Error(`Failed to find view ${id}; refresh the tree.`);
		}

		const { view } = parent;

		if (!isTrue(java.invoke(group, 'isInstance', [view]))) {
			return { nodes: [], total: 0 };
		}

		const [count, scrollX, scrollY] = await java.batchAsync(
			calls(view, ['getChildCount', 'getScrollX', 'getScrollY']),
		);
		const total = number(count);
		const end = Math.min(total, offset + limit);
		const indexes = Array.from(
			{ length: Math.max(end - offset, 0) },
			(_, index) => offset + index,
		);
		const found = await onMain(
			java,
			indexes.map((index) => ({
				op: 'invoke',
				handle: view,
				name: 'getChildAt',
				args: [int(index)],
			})),
		);
		const views = found.flatMap((value) => handle(value) ?? []);
		const scroll = { x: number(scrollX), y: number(scrollY) };
		const nodes = await describeAll(views, (local) => placeChild(parent.rect, local, scroll));

		return { nodes, total };
	}

	async function details(id: string) {
		const entry = entries.get(id);

		if (!entry) {
			throw new Error(`Failed to find view ${id}; refresh the tree.`);
		}

		return await readAndroidDetails(java, entry.view, density);
	}

	function prepareOverlay(root: NativeJavaHandleValue) {
		const target = handle(invoke(root, 'getOverlay'));

		if (!target) {
			throw new Error('Failed to read the decor view overlay.');
		}

		const parameters = ['android.graphics.drawable.Drawable'];

		return {
			handle: target,
			add: java.prepare(target, 'add', parameters),
			remove: java.prepare(target, 'remove', parameters),
		};
	}

	function prepareDrawable() {
		const shape = java.construct('android.graphics.drawable.GradientDrawable');

		java.invoke(shape, 'setColor', [int(FILL_COLOR)]);
		java.invoke(shape, 'setStroke', [int(STROKE_WIDTH_PX), int(STROKE_COLOR)]);

		return shape;
	}

	async function clearOutline() {
		if (!outlined || !overlay || !drawable) return;

		outlined = false;
		await java.invokePreparedAsync(overlay.remove, overlay.handle, [drawable]);
	}

	// A view's rectangle is known from its listing; a frame needs the decor view, which a listing may not have found yet.
	function outlineRect(target: OutlineTarget): PixelRect | undefined {
		if (typeof target === 'string') {
			return entries.get(target)?.rect;
		}

		if (!target) {
			return undefined;
		}

		attach();

		return toPixels(target, density);
	}

	async function highlight(target: OutlineTarget) {
		await clearOutline();

		const rect = outlineRect(target);

		if (!rect || !decor) return;

		overlay ??= prepareOverlay(decor);
		drawable ??= prepareDrawable();

		const { x, y, width, height } = rect;

		java.invoke(drawable, 'setBounds', [int(x), int(y), int(x + width), int(y + height)]);
		await java.invokePreparedAsync(overlay.add, overlay.handle, [drawable]);
		outlined = true;
	}

	async function reset() {
		await clearOutline();

		for (const { view } of entries.values()) {
			// The object explorer's refs outlive a relisting; its handle is released once the explorer drops it.
			if (explorerObjects.holds(view)) {
				continue;
			}

			try {
				java.release(view);
			} catch {
				// The loader already freed it, as it does when the activity goes away.
			}
		}

		if (overlay) {
			java.disposePlan(overlay.add);
			java.disposePlan(overlay.remove);
		}

		entries.clear();
		decor = undefined;
		resources = undefined;
		overlay = undefined;
	}

	return {
		list: (parent, page) => (parent === undefined ? roots(page) : children(parent, page)),
		details,
		handle: (id) => entries.get(id)?.view,
		highlight,
		reset,
	};
}

export default { createAndroidViewSource };
