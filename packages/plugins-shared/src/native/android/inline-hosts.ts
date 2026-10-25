import type {
	NativeJavaBridge,
	NativeJavaHandle,
	NativeJavaReference,
} from '@unbound-app/api/native';

import {
	javaFlag,
	javaFloat,
	javaInt,
	javaNumber,
	javaReference,
	javaText,
	sameJavaReference,
} from './java-values';

export type InlineHostBridge = Pick<
	NativeJavaBridge,
	'getClass' | 'invoke' | 'invokeAsync' | 'construct' | 'className'
>;

export type InlinePosition = {
	x: number;
	y: number;
};

export type HostSize = {
	width: number;
	height: number;
};

export type HostContainer = {
	container: NativeJavaReference;
	offset: InlinePosition;
};

const ALIGN_BOTTOM = 0;
const TRANSPARENT = 0;
const MAX_ANCESTOR_DEPTH = 12;
const MEASURE_EXACTLY = 1 << 30;

/**
 * @description Builds a transparent image span that reserves room for a view inside text, like a TextKit attachment.
 * @param java The plugin's Java bridge.
 * @param width The room's width, in pixels.
 * @param height The room's height, in pixels.
 * @returns The `ImageSpan`, to set over one placeholder character.
 */
export function spacerSpan(
	java: InlineHostBridge,
	width: number,
	height: number,
): NativeJavaReference {
	const drawable = java.construct('android.graphics.drawable.ColorDrawable', [
		javaInt(TRANSPARENT),
	]);

	java.invoke(drawable, 'setBounds', [
		javaInt(0),
		javaInt(0),
		javaInt(Math.round(width)),
		javaInt(Math.round(height)),
	]);

	return java.construct('android.text.style.ImageSpan', [drawable, javaInt(ALIGN_BOTTOM)]);
}

function hostsFreely(java: InlineHostBridge, view: NativeJavaReference): boolean {
	return (
		javaFlag(java.invoke(java.getClass('android.view.ViewGroup'), 'isInstance', [view])) &&
		!javaFlag(
			java.invoke(java.getClass('androidx.recyclerview.widget.RecyclerView'), 'isInstance', [
				view,
			]),
		)
	);
}

/**
 * @description Finds the nearest ancestor of a text view that can hold a free-floating child view, skipping recycler views.
 * @param java The plugin's Java bridge.
 * @param textView The text view the reserved room is in.
 * @returns The ancestor and the text view's offset inside it, or `null` when none was found.
 */
export function hostContainer(
	java: InlineHostBridge,
	textView: NativeJavaReference,
): HostContainer | null {
	let x = 0;
	let y = 0;
	let current: NativeJavaReference | null = textView;

	for (let depth = 0; current && depth < MAX_ANCESTOR_DEPTH; depth++) {
		x +=
			(javaNumber(java.invoke(current, 'getLeft', [])) ?? 0) -
			(javaNumber(java.invoke(current, 'getScrollX', [])) ?? 0);
		y +=
			(javaNumber(java.invoke(current, 'getTop', [])) ?? 0) -
			(javaNumber(java.invoke(current, 'getScrollY', [])) ?? 0);

		const parent = javaReference(java.invoke(current, 'getParent', []));

		if (!parent) return null;

		if (hostsFreely(java, parent)) {
			return { container: parent, offset: { x, y } };
		}

		current = parent;
	}

	return null;
}

/**
 * @description Measures where reserved room sits inside a text view, from its laid-out text.
 * @param java The plugin's Java bridge.
 * @param textView The text view.
 * @param index The index of the placeholder character carrying the spacer span.
 * @param height The reserved room's height, in pixels.
 * @returns The room's top-left corner inside the text view, or `null` before the text is laid out.
 */
export function reservedPosition(
	java: InlineHostBridge,
	textView: NativeJavaReference,
	index: number,
	height: number,
): InlinePosition | null {
	const layout = javaReference(java.invoke(textView, 'getLayout', []));

	if (!layout) return null;

	const line = javaNumber(java.invoke(layout, 'getLineForOffset', [javaInt(index)])) ?? 0;
	const bottom = javaNumber(java.invoke(layout, 'getLineBottom', [javaInt(line)])) ?? 0;
	const left = javaNumber(java.invoke(layout, 'getPrimaryHorizontal', [javaInt(index)])) ?? 0;

	return {
		x: left + (javaNumber(java.invoke(textView, 'getTotalPaddingLeft', [])) ?? 0),
		y: bottom - height + (javaNumber(java.invoke(textView, 'getTotalPaddingTop', [])) ?? 0),
	};
}

/**
 * @description Measures where the line holding reserved room starts inside a text view, for views pinned to the top of the room rather than its bottom.
 * @param java The plugin's Java bridge.
 * @param textView The text view.
 * @param index The index of the placeholder character carrying the spacer span.
 * @returns The line's top-left corner at the placeholder inside the text view, or `null` before the text is laid out.
 */
export function reservedTop(
	java: InlineHostBridge,
	textView: NativeJavaReference,
	index: number,
): InlinePosition | null {
	const layout = javaReference(java.invoke(textView, 'getLayout', []));

	if (!layout) return null;

	const line = javaNumber(java.invoke(layout, 'getLineForOffset', [javaInt(index)])) ?? 0;
	const top = javaNumber(java.invoke(layout, 'getLineTop', [javaInt(line)])) ?? 0;
	const left = javaNumber(java.invoke(layout, 'getPrimaryHorizontal', [javaInt(index)])) ?? 0;

	return {
		x: left + (javaNumber(java.invoke(textView, 'getTotalPaddingLeft', [])) ?? 0),
		y: top + (javaNumber(java.invoke(textView, 'getTotalPaddingTop', [])) ?? 0),
	};
}

/**
 * @description Creates an empty `FrameLayout` to mount a React surface into over reserved room.
 * @param java The plugin's Java bridge.
 * @param textView A view whose context the host shares.
 * @returns The host view.
 */
export function createHost(
	java: InlineHostBridge,
	textView: NativeJavaReference,
): NativeJavaHandle {
	const context = javaReference(java.invoke(textView, 'getContext', []));

	return java.construct('android.widget.FrameLayout', context ? [context] : []);
}

function layoutParamsClass(java: InlineHostBridge, container: NativeJavaReference): string {
	const count = javaNumber(java.invoke(container, 'getChildCount', [])) ?? 0;

	for (let index = 0; index < count; index++) {
		const child = javaReference(java.invoke(container, 'getChildAt', [javaInt(index)]));
		const params = child ? javaReference(java.invoke(child, 'getLayoutParams', [])) : null;
		const name = params ? javaText(java.className(params)) : undefined;

		if (name) {
			return name;
		}
	}

	return 'android.view.ViewGroup$LayoutParams';
}

async function fillHost(
	java: InlineHostBridge,
	host: NativeJavaReference,
	width: number,
	height: number,
): Promise<void> {
	const count = javaNumber(java.invoke(host, 'getChildCount', [])) ?? 0;

	for (let index = 0; index < count; index++) {
		const child = javaReference(java.invoke(host, 'getChildAt', [javaInt(index)]));

		if (!child) {
			continue;
		}

		await java.invokeAsync(child, 'measure', [
			javaInt(width | MEASURE_EXACTLY),
			javaInt(height | MEASURE_EXACTLY),
		]);
		await java.invokeAsync(child, 'layout', [
			javaInt(0),
			javaInt(0),
			javaInt(width),
			javaInt(height),
		]);
	}
}

/**
 * @description Sizes a host view, adds it to its container when it is elsewhere, and moves it over the reserved room. The host and the surfaces in it are measured and laid out directly, since a container that lays out only the children it knows about would leave the host at zero size, and a surface would keep the height it mounted at.
 * @param java The plugin's Java bridge.
 * @param host The host view.
 * @param container The view to hold it.
 * @param position The host's top-left corner inside the container.
 * @param size The host's width and height, in pixels.
 * @returns Resolves once the host is in place on the main thread.
 */
export async function placeHost(
	java: InlineHostBridge,
	host: NativeJavaReference,
	container: NativeJavaReference,
	position: InlinePosition,
	size: HostSize,
): Promise<void> {
	const params = java.construct(layoutParamsClass(java, container), [
		javaInt(Math.round(size.width)),
		javaInt(Math.round(size.height)),
	]);
	const parent = javaReference(java.invoke(host, 'getParent', []));

	const inContainer = sameJavaReference(parent, container);

	if (parent && !inContainer) {
		await java.invokeAsync(parent, 'removeView', [host]);
	}

	if (!inContainer) {
		await java.invokeAsync(container, 'addView', [host, params]);
	} else {
		await java.invokeAsync(host, 'setLayoutParams', [params]);
	}

	const width = Math.round(size.width);
	const height = Math.round(size.height);

	await java.invokeAsync(host, 'measure', [
		javaInt(width | MEASURE_EXACTLY),
		javaInt(height | MEASURE_EXACTLY),
	]);
	await java.invokeAsync(host, 'layout', [
		javaInt(0),
		javaInt(0),
		javaInt(width),
		javaInt(height),
	]);
	await fillHost(java, host, width, height);
	await java.invokeAsync(host, 'setTranslationX', [javaFloat(position.x)]);
	await java.invokeAsync(host, 'setTranslationY', [javaFloat(position.y)]);
}

/**
 * @description Lays out the recycler view a reserved row sits in at its current bounds. React Native views ignore layout requests from native children, so a row that grew would otherwise keep its old height.
 * @param java The plugin's Java bridge.
 * @param view A view inside the row.
 * @returns Resolves once the list has been laid out on the main thread, or at once when there is no list above the view.
 */
export async function layoutHostingList(
	java: InlineHostBridge,
	view: NativeJavaReference,
): Promise<void> {
	const recycler = java.getClass('androidx.recyclerview.widget.RecyclerView');
	let current = javaReference(java.invoke(view, 'getParent', []));

	for (let depth = 0; current && depth < MAX_ANCESTOR_DEPTH; depth++) {
		const parent = javaReference(java.invoke(current, 'getParent', []));
		const isList = javaFlag(java.invoke(recycler, 'isInstance', [current]));

		if (isList && parent && !javaFlag(java.invoke(recycler, 'isInstance', [parent]))) {
			const left = javaNumber(java.invoke(current, 'getLeft', [])) ?? 0;
			const top = javaNumber(java.invoke(current, 'getTop', [])) ?? 0;
			const width = javaNumber(java.invoke(current, 'getWidth', [])) ?? 0;
			const height = javaNumber(java.invoke(current, 'getHeight', [])) ?? 0;

			await java.invokeAsync(current, 'measure', [
				javaInt(width | MEASURE_EXACTLY),
				javaInt(height | MEASURE_EXACTLY),
			]);
			await java.invokeAsync(current, 'layout', [
				javaInt(left),
				javaInt(top),
				javaInt(left + width),
				javaInt(top + height),
			]);

			return;
		}

		current = parent;
	}
}

/**
 * @description Tells whether a host view still holds the surface mounted into it. Discord can drop that surface while recycling a message row, which leaves the host empty.
 * @param java The plugin's Java bridge.
 * @param host The host view.
 * @returns Whether the host has at least one child view.
 */
export function hostHasContent(java: InlineHostBridge, host: NativeJavaReference): boolean {
	return (javaNumber(java.invoke(host, 'getChildCount', [])) ?? 0) > 0;
}

/**
 * @description Takes a host view out of whatever holds it.
 * @param java The plugin's Java bridge.
 * @param host The host view.
 * @returns Resolves once it is removed.
 */
export async function removeHost(java: InlineHostBridge, host: NativeJavaReference): Promise<void> {
	const parent = javaReference(java.invoke(host, 'getParent', []));

	if (parent) {
		await java.invokeAsync(parent, 'removeView', [host]);
	}
}

export default {
	hostHasContent,
	createHost,
	hostContainer,
	layoutHostingList,
	placeHost,
	removeHost,
	reservedPosition,
	reservedTop,
	spacerSpan,
};
