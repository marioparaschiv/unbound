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
import type { OutlineTarget, ViewSource } from '~/debugger/view-finder.dev';

type Entry = { view: NativeJavaHandleValue; rect: PixelRect };

// React DevTools' highlight blue: a translucent fill under a solid outline.
const FILL_COLOR = 0x5561dafb;
const STROKE_COLOR = 0xff61dafb | 0;
const STROKE_WIDTH_PX = 4;

const int = (value: number): NativeJavaArgument => ({ type: 'int', value: Math.round(value) });
const handle = (value: NativeJavaValue): NativeJavaHandleValue | undefined =>
	value.type === 'handle' ? value : undefined;
const number = (value: NativeJavaValue) =>
	'value' in value && typeof value.value === 'number' ? value.value : 0;
const string = (value: NativeJavaValue) => (value.type === 'string' ? value.value : '');
const isTrue = (value: NativeJavaValue) => 'value' in value && value.value === true;

/**
 * @description Reads the current activity's Android view tree one level at a time, and outlines a view in the decor view's overlay.
 * @param java The loader's unscoped Java bridge.
 * @returns The Android view source.
 */
export function createAndroidViewSource(java: NativeJavaBridge): ViewSource {
	const entries = new Map<string, Entry>();
	const group = java.getClass('android.view.ViewGroup');
	const textView = java.getClass('android.widget.TextView');
	let decor: NativeJavaHandleValue | undefined;
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

	function resourceName(view: NativeJavaHandleValue): string | null {
		const id = number(invoke(view, 'getId'));
		const resources = isResourceId(id) ? handle(invoke(view, 'getResources')) : undefined;

		return resources
			? string(invoke(resources, 'getResourceEntryName', [int(id)])) || null
			: null;
	}

	function text(view: NativeJavaHandleValue): string | null {
		if (!isTrue(java.invoke(textView, 'isInstance', [view]))) return null;

		const value = invoke(view, 'getText');
		const sequence = handle(value);

		return clipText(sequence ? string(invoke(sequence, 'toString')) : string(value));
	}

	function describe(view: NativeJavaHandleValue, rect: PixelRect): ViewNode {
		entries.set(view.value, { view, rect });

		return {
			id: view.value,
			className: string(java.className(view)),
			resourceName: resourceName(view),
			frame: toDp(rect, density),
			visibility: androidVisibility(number(invoke(view, 'getVisibility'))),
			alpha: number(invoke(view, 'getAlpha')),
			text: text(view),
			childCount: isTrue(java.invoke(group, 'isInstance', [view]))
				? number(invoke(view, 'getChildCount'))
				: 0,
		};
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

		const resources = handle(invoke(view, 'getResources'));
		const metrics = resources ? handle(invoke(resources, 'getDisplayMetrics')) : undefined;

		density = metrics ? number(java.getField(metrics, 'density')) || 1 : 1;
		decor = view;

		return view;
	}

	async function roots(): Promise<ViewNode[]> {
		await reset();

		const root = attach();
		const size = {
			width: number(invoke(root, 'getWidth')),
			height: number(invoke(root, 'getHeight')),
		};

		return [describe(root, { x: 0, y: 0, ...size })];
	}

	function children(id: string): ViewNode[] {
		const parent = entries.get(id);

		if (!parent) {
			throw new Error(`Failed to find view ${id}; refresh the tree.`);
		}

		const { view } = parent;
		const count = isTrue(java.invoke(group, 'isInstance', [view]))
			? number(invoke(view, 'getChildCount'))
			: 0;
		const scroll = {
			x: number(invoke(view, 'getScrollX')),
			y: number(invoke(view, 'getScrollY')),
		};
		const nodes: ViewNode[] = [];

		for (let index = 0; index < count; index++) {
			const child = handle(invoke(view, 'getChildAt', [int(index)]));

			if (!child) {
				continue;
			}

			const local = {
				x: number(invoke(child, 'getX')),
				y: number(invoke(child, 'getY')),
				width: number(invoke(child, 'getWidth')),
				height: number(invoke(child, 'getHeight')),
			};

			nodes.push(describe(child, placeChild(parent.rect, local, scroll)));
		}

		return nodes;
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
		overlay = undefined;
	}

	return {
		list: async (parent) => (parent === undefined ? await roots() : children(parent)),
		highlight,
		reset,
	};
}

export default { createAndroidViewSource };
