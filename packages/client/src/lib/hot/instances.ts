import type { Component, ExoticType, Fiber } from '~/lib/hot/refresh';

/** Owns the hooks the patched function itself calls, as opposed to a patch callback's. */
export const ORIGINAL = Symbol('original');

/** Whatever called a run of hooks: a patch callback, or the patched function itself. */
export type Owner = Callback | typeof ORIGINAL;

/** A wrapped patch callback, with the hook objects each of its segments used in its last render. */
export type Callback = {
	untrackedCounts: (number | null)[];
};

/** A run of consecutive hooks in a component's hook list; `count` is `null` when unknown. */
export type Segment = {
	owner: Owner;
	count: number | null;
};

/** A component's hook list, as the runs of hooks each owner called, in order. */
export type Layout = Segment[];

/** The layout of one render, and the length of the hook list it built. */
export type Rendered = {
	layout: Layout;
	length: number;
};

/** A mounted component live patching renders through its own trampoline. */
export type Instance = {
	/** One fiber of the pair React swaps between renders; the other is its alternate. */
	fiber: Fiber;
	/** What the trampoline renders. */
	target: Component | ExoticType;
	/** The layout of the hook list React last committed. */
	layout: Layout;
	/** The layout of the latest render, until it is known whether React committed it. */
	pending: Rendered | null;
};

/** A run of hooks to cut from a hook list. */
export type Slice = {
	start: number;
	count: number;
};

/** A layout with some owners' segments cut out, and the hooks to remove for them, last first. */
export type Cut = {
	layout: Layout;
	slices: Slice[];
};

/**
 * @description Checks a layout against a hook list: its known counts must not exceed the list's length,
 * and must match it exactly when every count is known.
 * @param layout The layout to check.
 * @param length The hook list's length.
 * @returns Whether the layout can describe the list.
 */
export function fits(layout: Layout, length: number): boolean {
	let known = 0;
	let complete = true;

	for (const segment of layout) {
		if (segment.count === null) {
			complete = false;
		} else {
			known += segment.count;
		}
	}

	return complete ? known === length : known <= length;
}

/**
 * @description Fills the one unknown count of a layout from the hook list's length.
 * @param layout The layout; it is not changed.
 * @param length The length of the hook list it describes.
 * @returns A copy whose single unknown count is filled in, or an unchanged copy otherwise.
 */
export function resolve(layout: Layout, length: number): Layout {
	const copy = layout.map((segment) => ({ ...segment }));
	const unknown = copy.filter((segment) => segment.count === null);

	if (unknown.length !== 1 || !fits(copy, length)) {
		return copy;
	}

	const known = copy.reduce((sum, segment) => sum + (segment.count ?? 0), 0);

	unknown[0].count = length - known;

	return copy;
}

/**
 * @description Promotes an instance's pending layout once React has committed the render it describes.
 * @param instance The instance.
 * @param length The length of its current fiber's hook list.
 */
export function commit(instance: Instance, length: number): void {
	const { pending } = instance;

	instance.pending = null;

	if (pending?.length === length) {
		instance.layout = pending.layout;
	}
}

/**
 * @description Finds where a segment's hooks start: counted from the head when every earlier count is
 * known, otherwise from the tail when its own and every later count are.
 * @param layout The layout.
 * @param index The segment's index in the layout.
 * @param length The length of the hook list the layout describes.
 * @returns The index of the segment's first hook, or `null` when it can't be known.
 */
export function offsetOf(layout: Layout, index: number, length: number): number | null {
	const head = sum(layout.slice(0, index));

	if (head !== null) {
		return head;
	}

	const tail = sum(layout.slice(index));

	return tail === null ? null : length - tail;
}

/**
 * @description Cuts every segment of the given owners out of a layout.
 * @param layout The layout.
 * @param removed Picks the owners to cut.
 * @param length The length of the hook list the layout describes.
 * @returns The remaining layout and the hooks to remove, or `null` when a segment's position is unknown.
 */
export function cut(
	layout: Layout,
	removed: (owner: Owner) => boolean,
	length: number,
): Cut | null {
	const slices: Slice[] = [];

	for (let i = layout.length - 1; i >= 0; i--) {
		const { owner, count } = layout[i];

		if (!removed(owner)) {
			continue;
		}

		const start = offsetOf(layout, i, length);

		if (start === null || count === null) return null;

		if (count) {
			slices.push({ start, count });
		}
	}

	return { layout: layout.filter((segment) => !removed(segment.owner)), slices };
}

function sum(layout: Layout) {
	let total = 0;

	for (const segment of layout) {
		if (segment.count === null) return null;

		total += segment.count;
	}

	return total;
}

export default { ORIGINAL, fits, resolve, commit, offsetOf, cut };
