import type {
	NativeJavaBatchOperation,
	NativeJavaBridge,
	NativeJavaReference,
} from '@unbound-app/api/native';
import { displayDensity, readCalls, runOnMain } from '@unbound-plugins/shared/native/android/views';
import {
	javaFlag,
	javaFloat,
	javaInt,
	javaNumber,
	javaReference,
	sameJavaReference,
} from '@unbound-plugins/shared/native/android/java-values';
import {
	MESSAGE_CONTENT_VIEW,
	viewByIdNameAsync,
} from '@unbound-plugins/shared/native/android/discord-views';

import { columnEndFrom, isLaidOut, rowContentStart, union, type Edges } from '~/lib/geometry';
import { AndroidClass } from '~/lib/constants';

/** What a message row's header shows: its left, top and bottom in the row, and whether it is visible. */
export type RowHeader = { left: number; top: number; bottom: number; shown: boolean };

/** A message row's content area, content column, header, size, background and the footer icon moves its bubble needs. */
export type RowMeasure = {
	area: Edges | undefined;
	column: Edges | undefined;
	columnLeft: number | undefined;
	header: RowHeader | undefined;
	width: number;
	height: number;
	background: NativeJavaReference | null;
	iconShifts: NativeJavaBatchOperation[];
};

type MeasuredChild = { child: NativeJavaReference; width: number; left: number; right: number };

type RowMeasureOptions = {
	/** Footer icons the measure moved, so the caller can move them back. */
	shiftedIcons: NativeJavaReference[];
	/** Measures a row again once its column's gutter is known. */
	remeasure: (row: NativeJavaReference) => void;
};

const MAX_AWAITING = 256;
const VISIBLE = 0;
const ICON_SPACING_DP = 4;
const MATCH_PARENT = -1;
const CHILD_READS = [
	'getVisibility',
	'getWidth',
	'getHeight',
	'getLeft',
	'getRight',
	'getTop',
	'getBottom',
];
const ROW_READS = ['getWidth', 'getHeight', 'getBackground'];
const ACCESSORIES_READS = ['getLeft', 'getTop', 'getWidth'];

/**
 * @description Reads a number a view method returns, or 0.
 * @param java The plugin's Java bridge.
 * @param view The view to read.
 * @param method The getter to call.
 * @returns The number, or 0 when the call returned none.
 */
export function readNumber(
	java: NativeJavaBridge,
	view: NativeJavaReference,
	method: string,
): number {
	return javaNumber(java.invoke(view, method, [])) ?? 0;
}

/**
 * @description Checks whether a view is an instance of a Java class.
 * @param java The plugin's Java bridge.
 * @param type The class to test against.
 * @param view The view to test.
 * @returns Whether the view is an instance of the class.
 */
export function isInstanceOf(
	java: NativeJavaBridge,
	type: NativeJavaReference,
	view: NativeJavaReference,
): boolean {
	return javaFlag(java.invoke(type, 'isInstance', [view]));
}

/**
 * @description Measures Android message rows: where their content and content column sit, and how far the footer icon moves to hug its label.
 * @param java The plugin's Java bridge.
 * @param options The shifted-icon list to fill, and how to measure a row again once its column's gutter is learned.
 * @returns `measureRow`, which reads one row, and `density`, the display density.
 */
export function createRowMeasure(
	java: NativeJavaBridge,
	{ shiftedIcons, remeasure }: RowMeasureOptions,
) {
	const contentClass = java.getClass(MESSAGE_CONTENT_VIEW);
	const textViewClass = java.getClass('android.widget.TextView');
	const imageViewClass = java.getClass('android.widget.ImageView');
	const columnGutters = new Map<number, number>();
	const awaitingGutter: NativeJavaReference[] = [];
	let densityValue: Promise<number> | undefined;

	function density(view: NativeJavaReference): Promise<number> {
		densityValue ??= displayDensity(java, view);

		return densityValue;
	}

	async function directChildren(group: NativeJavaReference, className: string) {
		const found = await java.findViews(group, className, { maxDepth: 1, maxResults: 256 });

		return found
			.map((child) => javaReference(child))
			.filter(
				(child): child is NativeJavaReference =>
					!!child && !sameJavaReference(child, group),
			);
	}

	async function textWidth(view: NativeJavaReference, width: number): Promise<number> {
		const [layoutValue, paddingLeft, paddingRight] = await runOnMain(
			java,
			readCalls(view, ['getLayout', 'getTotalPaddingLeft', 'getTotalPaddingRight']),
		);
		const layout = javaReference(layoutValue);

		if (!layout) return width;

		let widest = 0;

		for (let line = 0; line < readNumber(java, layout, 'getLineCount'); line++) {
			widest = Math.max(
				widest,
				javaNumber(java.invoke(layout, 'getLineWidth', [javaInt(line)])) ?? 0,
			);
		}

		return Math.ceil(widest) + (javaNumber(paddingLeft) ?? 0) + (javaNumber(paddingRight) ?? 0);
	}

	async function measureRow(
		row: NativeJavaReference,
		tight: boolean,
	): Promise<RowMeasure | undefined> {
		const [[accessories], header] = await Promise.all([
			directChildren(row, AndroidClass.accessories),
			readHeader(row),
		]);

		if (!accessories) return;

		const kids = await directChildren(accessories, 'android.view.View');
		const values = await runOnMain(java, [
			...readCalls(row, ROW_READS),
			...readCalls(accessories, ACCESSORIES_READS),
			...kids.flatMap((child) => readCalls(child, CHILD_READS)),
		]);
		const [rowWidth, rowHeight, background, accessoriesLeft, accessoriesTop, accessoriesWidth] =
			values;
		const childValues = values.slice(ROW_READS.length + ACCESSORIES_READS.length);
		const measured = kids.map((child, index) => {
			const [visibility, width, height, left, right, top, bottom] = childValues
				.slice(index * CHILD_READS.length, (index + 1) * CHILD_READS.length)
				.map((value) => javaNumber(value) ?? 0);

			return { child, visibility, width, height, left, right, top, bottom };
		});
		const shown = measured.filter(
			(child) => child.visibility === VISIBLE && child.width > 0 && child.height > 0,
		);
		const iconShifts: NativeJavaBatchOperation[] = [];
		const rights = tight
			? await Promise.all(shown.map((child) => tightRight(child, iconShifts)))
			: shown.map((child) => child.right);
		const x = javaNumber(accessoriesLeft);
		const y = javaNumber(accessoriesTop) ?? 0;
		const columnLeft = header && isLaidOut(header.left) ? header.left : undefined;
		const edges = (right: (index: number) => number) =>
			union(
				shown.map((child, index) => ({
					left: child.left,
					top: child.top,
					right: right(index),
					bottom: child.bottom,
				})),
			);
		const whole = offsetArea(
			edges((index) => shown[index]!.right),
			x,
			y,
			columnLeft,
		);
		const end =
			tight || !whole || x === undefined
				? undefined
				: await columnEnd(row, shown, javaNumber(accessoriesWidth) ?? 0);

		return {
			area: tight
				? offsetArea(
						edges((index) => rights[index]!),
						x,
						y,
						columnLeft,
					)
				: whole,
			column: whole && {
				...whole,
				top: header?.shown ? Math.min(header.top, whole.top) : whole.top,
				right: Math.max(whole.right, end === undefined ? 0 : end + x!),
			},
			columnLeft,
			header,
			width: javaNumber(rowWidth) ?? 0,
			height: javaNumber(rowHeight) ?? 0,
			background: javaReference(background),
			iconShifts,
		};
	}

	async function columnEnd(
		row: NativeJavaReference,
		shown: { child: NativeJavaReference; right: number }[],
		width: number,
	): Promise<number | undefined> {
		const params = await runOnMain(
			java,
			shown.flatMap(({ child }) => readCalls(child, ['getLayoutParams'])),
		);
		const filling = shown.filter((_, index) => {
			const layout = javaReference(params[index]);

			return layout && javaNumber(java.getField(layout, 'width')) === MATCH_PARENT;
		});

		const known = columnGutters.get(width);
		const { end, gutter } = columnEndFrom(
			filling.map((child) => child.right),
			width,
			known,
		);

		if (end !== undefined) {
			if (gutter !== undefined) columnGutters.set(width, gutter);

			if (known === undefined) awaitingGutter.splice(0).forEach(remeasure);

			return end;
		}

		if (!awaitingGutter.some((entry) => sameJavaReference(entry, row)))
			awaitingGutter.push(row);

		if (awaitingGutter.length > MAX_AWAITING) awaitingGutter.shift();
	}

	function offsetArea(
		area: Edges | undefined,
		x: number | undefined,
		y: number,
		columnLeft: number | undefined,
	): Edges | undefined {
		if (!area || x === undefined || !isLaidOut(area.left + x)) return;

		return {
			left: rowContentStart(area.left + x, columnLeft),
			top: area.top + y,
			right: area.right + x,
			bottom: area.bottom + y,
		};
	}

	async function tightRight(
		measured: MeasuredChild,
		iconShifts: NativeJavaBatchOperation[],
	): Promise<number> {
		if (isInstanceOf(java, contentClass, measured.child)) {
			return Math.min(
				measured.right,
				measured.left + (await textWidth(measured.child, measured.width)),
			);
		}

		return (await footerRight(measured, iconShifts)) ?? measured.right;
	}

	async function footerRight(
		footer: MeasuredChild,
		iconShifts: NativeJavaBatchOperation[],
	): Promise<number | undefined> {
		const children = await directChildren(footer.child, 'android.view.View');

		if (children.length !== 3) return;

		const reads = await runOnMain(
			java,
			children.flatMap((child) => readCalls(child, ['getVisibility', 'getWidth'])),
		);

		if (reads.some((value, index) => index % 2 === 0 && javaNumber(value) !== VISIBLE)) return;

		const [, label, icon] = children as [
			NativeJavaReference,
			NativeJavaReference,
			NativeJavaReference,
		];

		if (!isInstanceOf(java, textViewClass, label) || !isInstanceOf(java, imageViewClass, icon))
			return;

		const labelWidth = javaNumber(reads[3]) ?? 0;
		const spacing = ICON_SPACING_DP * (await density(icon));
		const gap = Math.max(0, labelWidth - (await textWidth(label, labelWidth)) - spacing);

		if (!shiftedIcons.some((entry) => sameJavaReference(entry, icon))) shiftedIcons.push(icon);

		iconShifts.push({
			op: 'invoke',
			handle: icon,
			name: 'setTranslationX',
			args: [javaFloat(-gap)],
		});

		return footer.right - gap;
	}

	async function readHeader(row: NativeJavaReference): Promise<RowHeader | undefined> {
		const header = await viewByIdNameAsync(java, row, 'header');

		if (!header) return;

		const [visibility, height, left, top, bottom] = (
			await runOnMain(
				java,
				readCalls(header, ['getVisibility', 'getHeight', 'getLeft', 'getTop', 'getBottom']),
			)
		).map((value) => javaNumber(value) ?? 0);

		return {
			left: left!,
			top: top!,
			bottom: bottom!,
			shown: visibility === VISIBLE && height! > 0,
		};
	}

	return { measureRow, density };
}

export default { createRowMeasure, isInstanceOf, readNumber };
