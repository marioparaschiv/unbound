import type { NativeJavaBridge, NativeJavaReference, NativeUIScope } from '@unbound-app/api/native';
import {
	javaFlag,
	javaInt,
	javaNumber,
	javaReference,
	javaText,
} from '@unbound-plugins/shared/native/android/java-values';

import type { RowViewIds, RowViewName } from '~/native/android/ids';

/** A view's place in its row, in pixels, as the main thread read it. */
export type ViewRead = {
	view: NativeJavaReference;
	className: string;
	visibility: number;
	width: number;
	height: number;
	left: number;
	top: number;
	reach?: number;
};

const REACH = { depth: 4, views: 32 };
const VISIBLE = 0;

/** One consistent read of a laid-out row: every view the measure needs, taken in one pass on the main thread. */
export type RowRead = {
	id: string;
	width: number;
	height: number;
	paddingTop: number;
	/** How far the accessories are moved in by translation, which the row's own offsets leave out. */
	shift: number;
	views: Partial<Record<RowViewName, ViewRead>>;
	/** The accessories' items, in order. */
	children: ViewRead[];
};

function readView(
	java: NativeJavaBridge,
	row: NativeJavaReference,
	view: NativeJavaReference,
	rect: NativeJavaReference,
): ViewRead {
	'worklet';
	const zero = javaInt(0);

	java.invoke(rect, 'set', [zero, zero, zero, zero]);
	java.invoke(row, 'offsetDescendantRectToMyCoords', [view, rect]);

	return {
		view,
		className: javaText(java.className(view)) ?? '',
		visibility: javaNumber(java.invoke(view, 'getVisibility', [])) ?? 0,
		width: javaNumber(java.invoke(view, 'getWidth', [])) ?? 0,
		height: javaNumber(java.invoke(view, 'getHeight', [])) ?? 0,
		left: javaNumber(java.getField(rect, 'left')) ?? 0,
		top: javaNumber(java.getField(rect, 'top')) ?? 0,
	};
}

function reachOf(
	java: NativeJavaBridge,
	row: NativeJavaReference,
	view: NativeJavaReference,
	rect: NativeJavaReference,
	budget: { views: number },
	depth = 0,
): number | undefined {
	'worklet';
	const read = readView(java, row, view, rect);

	if (read.visibility !== VISIBLE || read.width <= 0 || read.height <= 0) return undefined;

	const own = read.left + read.width;
	const isGroup = javaFlag(
		java.invoke(java.getClass('android.view.ViewGroup'), 'isInstance', [view]),
	);
	const count = isGroup ? (javaNumber(java.invoke(view, 'getChildCount', [])) ?? 0) : 0;

	if (!count || depth >= REACH.depth) return own;

	let reach: number | undefined;

	for (let index = 0; index < count && budget.views > 0; index++) {
		const child = javaReference(java.invoke(view, 'getChildAt', [javaInt(index)]));

		budget.views--;

		const right = child ? reachOf(java, row, child, rect, budget, depth + 1) : undefined;

		if (right !== undefined) reach = Math.max(reach ?? 0, right);
	}

	if (budget.views <= 0) return own;

	return reach ?? read.left;
}

/**
 * @description Reads a message row's views for its bubble in one pass on the main thread, so the read sees one message and one layout, never a row rebound or laid out halfway through.
 * @param scope The plugin's UI scope.
 * @param handle The row's handle.
 * @param ids The row views' resource ids.
 * @param idField The row's message id field.
 * @returns The read, or `null` while the row shows no message or waits for a layout that will change it.
 */
export function readRow(
	scope: NativeUIScope,
	handle: string,
	ids: RowViewIds,
	idField: string,
): RowRead | null {
	'worklet';
	const java = scope.java as NativeJavaBridge;
	const row = { type: 'handle', value: handle } as NativeJavaReference;
	const id = javaText(java.getField(row, idField));
	const width = javaNumber(java.invoke(row, 'getWidth', [])) ?? 0;

	// A row bound to a new message keeps its old message's layout until its next layout pass, which measures it again.
	if (!id || !width || javaFlag(java.invoke(row, 'isLayoutRequested', []))) return null;

	const rect = java.construct('android.graphics.Rect', []);
	const views: RowRead['views'] = {};

	for (const name of Object.keys(ids) as RowViewName[]) {
		const view = ids[name]
			? javaReference(java.invoke(row, 'findViewById', [javaInt(ids[name])]))
			: null;

		if (view) views[name] = readView(java, row, view, rect);
	}

	const accessories = views.accessories_view?.view;

	if (!accessories) return null;

	const count = javaNumber(java.invoke(accessories, 'getChildCount', [])) ?? 0;
	const children: ViewRead[] = [];

	for (let index = 0; index < count; index++) {
		const child = javaReference(java.invoke(accessories, 'getChildAt', [javaInt(index)]));

		if (!child) continue;

		const read = readView(java, row, child, rect);
		const reach = reachOf(java, row, child, rect, { views: REACH.views });

		children.push(reach === undefined ? read : { ...read, reach });
	}

	return {
		id,
		width,
		height: javaNumber(java.invoke(row, 'getHeight', [])) ?? 0,
		paddingTop: javaNumber(java.invoke(row, 'getPaddingTop', [])) ?? 0,
		shift: javaNumber(java.invoke(accessories, 'getTranslationX', [])) ?? 0,
		views,
		children,
	};
}

export default { readRow };
