import type {
	NativeJavaArgument,
	NativeJavaBatchOperation,
	NativeJavaBridge,
	NativeJavaReference,
	NativeJavaValue,
	NativeUIScope,
} from '@unbound-app/api/native';
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
	/** The union of the visible leaf views it draws, in row pixels, which can be smaller or larger than the view itself. */
	extent?: Extent;
};

/** A box in row pixels, as edges. */
export type Extent = { left: number; top: number; right: number; bottom: number };

const REACH = { depth: 4, views: 32 };
const VISIBLE = 0;
/** The most steps the bridge takes in one batch. */
const MAX_BATCH = 64;
/** The row views the measure reads; the reply spine and avatar decoration only move, so their places are never read. */
const MEASURED_VIEWS: RowViewName[] = [
	'header',
	'author_name',
	'timestamp',
	'reply_preview_view',
	'reply_leading_views',
	'reply_text',
	'accessories_view',
	'author_avatar',
	'mosaic',
];
const COLOR_DRAWABLE = 'android.graphics.drawable.ColorDrawable';
const CARD_DRAWABLES = ['GradientDrawable', 'ShapeDrawable', 'MaterialShapeDrawable'];

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

/** Reads waiting for the next batch, each with what to do with its result. */
type Queue = { ops: NativeJavaBatchOperation[]; takes: ((value: NativeJavaValue) => void)[] };

/** A view in an item's tree, as far as the reads reached. */
type Node = {
	depth: number;
	own?: Extent;
	/** Whether it paints a card behind its children, which then counts as drawn. */
	card?: boolean;
	/** How many children it has, read only for a visible group that may go deeper. */
	count?: number;
	children: Node[];
};

function queue(
	into: Queue,
	op: NativeJavaBatchOperation,
	take: (value: NativeJavaValue) => void = () => {},
) {
	'worklet';
	into.ops.push(op);
	into.takes.push(take);
}

function invoke(handle: NativeJavaReference, name: string, args: NativeJavaArgument[] = []) {
	'worklet';

	return { op: 'invoke', handle, name, args } as NativeJavaBatchOperation;
}

// Each batch is one bridge call; a result's take may queue more reads, which go in a later one.
function drain(java: NativeJavaBridge, from: Queue) {
	'worklet';

	while (from.ops.length) {
		const ops = from.ops.splice(0, MAX_BATCH);
		const takes = from.takes.splice(0, MAX_BATCH);
		const results = java.batch(ops);

		for (let index = 0; index < takes.length; index++) takes[index]!(results[index]!);
	}
}

// The rect is shared: the batch runs its steps in order, so no other view's offsets land in between.
function readView(
	into: Queue,
	row: NativeJavaReference,
	view: NativeJavaReference,
	rect: NativeJavaReference,
	done: (read: ViewRead) => void,
) {
	'worklet';
	const values: number[] = [];
	const keep = (value: NativeJavaValue) => {
		values.push(javaNumber(value) ?? 0);
	};

	queue(into, invoke(rect, 'setEmpty'));
	queue(into, invoke(row, 'offsetDescendantRectToMyCoords', [view, rect]));
	// `left top right bottom`, both offsets in one read.
	queue(into, invoke(rect, 'flattenToString'), (value) => {
		const [left = 0, top = 0] = (javaText(value) ?? '').split(' ').map(Number);

		values.push(left || 0, top || 0);
	});
	queue(into, invoke(view, 'getVisibility'), keep);
	queue(into, invoke(view, 'getWidth'), keep);
	queue(into, invoke(view, 'getHeight'), (value) => {
		keep(value);

		const [left = 0, top = 0, visibility = 0, width = 0, height = 0] = values;

		done({ view, className: '', visibility, width, height, left, top });
	});
}

function readClassName(into: Queue, of: NativeJavaReference, done: (name: string) => void) {
	'worklet';

	queue(into, invoke(of, 'getClass'), (value) => {
		const type = javaReference(value);

		if (type) queue(into, invoke(type, 'getName'), (name) => done(javaText(name) ?? ''));
	});
}

function readCard(into: Queue, view: NativeJavaReference, node: Node) {
	'worklet';

	queue(into, invoke(view, 'getBackground'), (value) => {
		const background = javaReference(value);

		if (!background) return;

		readClassName(into, background, (name) => {
			if (name !== COLOR_DRAWABLE) {
				node.card = CARD_DRAWABLES.some((kind) => name.endsWith(kind));

				return;
			}

			// A transparent color paints nothing.
			queue(into, invoke(background, 'getColor'), (color) => {
				node.card = (javaNumber(color) ?? 0) >>> 24 > 0;
			});
		});
	});
}

// Reads a view and, level by level, the views it draws, sharing `budget` across the whole tree.
function readTree(
	into: Queue,
	context: { row: NativeJavaReference; rect: NativeJavaReference; group: NativeJavaReference },
	view: NativeJavaReference,
	node: Node,
	budget: { views: number },
	done?: (read: ViewRead) => void,
) {
	'worklet';
	const { row, rect, group } = context;

	readView(into, row, view, rect, (read) => {
		done?.(read);

		if (read.visibility !== VISIBLE || read.width <= 0 || read.height <= 0) return;

		node.own = {
			left: read.left,
			top: read.top,
			right: read.left + read.width,
			bottom: read.top + read.height,
		};
	});
	queue(into, invoke(group, 'isInstance', [view]), (isGroup) => {
		if (!node.own || !javaFlag(isGroup) || node.depth >= REACH.depth) return;

		queue(into, invoke(view, 'getChildCount'), (value) => {
			const count = javaNumber(value) ?? 0;

			node.count = count;

			if (!count) return;

			readCard(into, view, node);

			const reached = Math.max(0, Math.min(count, budget.views));

			budget.views -= reached;
			// Callbacks, not a loop: worklets compile loop bindings to one shared `var`, which every take would see last.
			node.children = Array.from({ length: reached }, (_, index) => {
				const child: Node = { depth: node.depth + 1, children: [] };

				queue(into, invoke(view, 'getChildAt', [javaInt(index)]), (found) => {
					const reference = javaReference(found);

					if (reference) readTree(into, context, reference, child, budget);
				});

				return child;
			});
		});
	});
}

function joinExtents(first: Extent | undefined, second: Extent): Extent {
	'worklet';

	return first
		? {
				left: Math.min(first.left, second.left),
				top: Math.min(first.top, second.top),
				right: Math.max(first.right, second.right),
				bottom: Math.max(first.bottom, second.bottom),
			}
		: second;
}

function extentOf(node: Node): Extent | undefined {
	'worklet';
	const { own } = node;

	if (!own || !node.count) return own;

	let extent: Extent | undefined;

	for (const child of node.children) {
		const inner = extentOf(child);

		if (inner) extent = joinExtents(extent, inner);
	}

	if (node.card) extent = joinExtents(extent, own);

	// A group that draws nothing visible adds nothing; at the top it collapses to its corner.
	return (
		extent ??
		(node.depth === 0
			? { left: own.left, top: own.top, right: own.left, bottom: own.top }
			: undefined)
	);
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
	const names = MEASURED_VIEWS.filter((name) => ids[name]);
	const head = java.batch([
		{ op: 'getField', handle: row, name: idField },
		invoke(row, 'getWidth'),
		invoke(row, 'isLayoutRequested'),
		invoke(row, 'getHeight'),
		invoke(row, 'getPaddingTop'),
	]);
	const id = javaText(head[0]);
	const width = javaNumber(head[1]) ?? 0;

	// A row bound to a new message keeps its old message's layout until its next layout pass, which measures it again.
	if (!id || !width || javaFlag(head[2])) return null;

	const byId = java.batch(names.map((name) => invoke(row, 'findViewById', [javaInt(ids[name])])));
	const found = names.map((name, index) => [name, javaReference(byId[index])] as const);
	const accessories = found.find(([name]) => name === 'accessories_view')?.[1];

	if (!accessories) return null;

	const context = {
		row,
		rect: java.construct('android.graphics.Rect', []),
		group: java.getClass('android.view.ViewGroup'),
	};
	const pending: Queue = { ops: [], takes: [] };
	const views: RowRead['views'] = {};
	const items: { read?: ViewRead; className: string; node: Node; budget: { views: number } }[] =
		[];
	let shift = 0;

	found.forEach(([name, view]) => {
		if (view)
			readView(pending, row, view, context.rect, (read) => {
				views[name] = read;
			});
	});
	queue(pending, invoke(accessories, 'getTranslationX'), (value) => {
		shift = javaNumber(value) ?? 0;
	});
	queue(pending, invoke(accessories, 'getChildCount'), (counted) => {
		const count = javaNumber(counted) ?? 0;

		for (let index = 0; index < count; index++) {
			queue(pending, invoke(accessories, 'getChildAt', [javaInt(index)]), (value) => {
				const child = javaReference(value);

				if (!child) return;

				const item = {
					className: '',
					node: { depth: 0, children: [] },
					budget: { views: REACH.views },
				} as (typeof items)[number];

				items.push(item);
				readClassName(pending, child, (name) => {
					item.className = name;
				});
				readTree(pending, context, child, item.node, item.budget, (read) => {
					item.read = read;
				});
			});
		}
	});
	drain(java, pending);

	const children = items.map(({ read, className, node, budget }) => {
		// A tree too big to read in full counts as the item's own box.
		const extent = budget.views <= 0 ? node.own : extentOf(node);

		return extent === undefined
			? { ...read!, className }
			: { ...read!, className, reach: extent.right, extent };
	});

	return {
		id,
		width,
		height: javaNumber(head[3]) ?? 0,
		paddingTop: javaNumber(head[4]) ?? 0,
		shift,
		views,
		children,
	};
}

export default { readRow };
