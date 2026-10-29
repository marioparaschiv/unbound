import type {
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeJavaReference,
} from '@unbound-app/api/native';
import {
	currentDecorView,
	findViewsOfClass,
	readCalls,
	runOnMain,
} from '@unbound-plugins/shared/native/android/views';
import {
	javaFlag,
	javaFloat,
	javaInt,
	javaNumber,
	javaReference,
	javaText,
	sameJavaReference,
} from '@unbound-plugins/shared/native/android/java-values';
import {
	messageIdField,
	viewByIdNameAsync,
} from '@unbound-plugins/shared/native/android/discord-views';

import { bubbleFrame, rowInsets, union, type Edges } from '~/geometry';
import { AndroidClass, PLUGIN_NAME } from '~/constants';
import { currentAppearance } from '~/theme';
import { argb } from '~/style';
import { isOwnMessage } from '~/author';

type AndroidNative = {
	java: NativeJavaBridge;
	hooks: NativeJavaHooksBridge;
};

const MAX_TRACKED = 256;
const MAX_ANCESTORS = 16;
const VISIBLE = 0;
const LAYOUT_PARAMETERS = ['boolean', 'int', 'int', 'int', 'int'];

/**
 * @description Draws a rounded bubble behind each Android message as the row's background, sized to its content without changing the row's padding.
 * @param native The plugin's Java and hook bridges.
 * @returns `refresh`, which repaints the bubbles it drew, and `dispose`, which brings back the rows' own backgrounds.
 */
export function drawAndroidBubbles({ java, hooks }: AndroidNative) {
	const accessoriesClass = java.getClass(AndroidClass.accessories);
	const messageClass = java.getClass(AndroidClass.messageView);
	const idField = messageIdField(java);
	const contentClass = java.getClass(AndroidClass.content);
	const ours = java.createAssociationKey();
	const original = java.createAssociationKey();
	const tracked: NativeJavaReference[] = [];
	const pending: NativeJavaReference[] = [];
	let scheduled = false;
	let disposed = false;
	let contentStart = Number.POSITIVE_INFINITY;
	const measuredLefts: { row: NativeJavaReference; left: number }[] = [];

	function noteContentStart(row: NativeJavaReference, left: number) {
		const index = measuredLefts.findIndex((entry) => sameJavaReference(entry.row, row));

		if (index >= 0) measuredLefts.splice(index, 1);

		measuredLefts.push({ row, left });

		if (measuredLefts.length > MAX_TRACKED) measuredLefts.shift();

		if (left >= contentStart) return;

		contentStart = left;

		for (const entry of measuredLefts) {
			if (entry.left > contentStart) schedule(entry.row);
		}
	}

	const number = (view: NativeJavaReference, method: string) =>
		javaNumber(java.invoke(view, method, [])) ?? 0;
	const isInstance = (type: NativeJavaReference, view: NativeJavaReference) =>
		javaFlag(java.invoke(type, 'isInstance', [view]));

	async function directChildren(group: NativeJavaReference, className: string) {
		const found = await java.findViews!(group, className, { maxDepth: 1, maxResults: 256 });

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

		for (let line = 0; line < number(layout, 'getLineCount'); line++) {
			widest = Math.max(
				widest,
				javaNumber(java.invoke(layout, 'getLineWidth', [javaInt(line)])) ?? 0,
			);
		}

		return Math.ceil(widest) + (javaNumber(paddingLeft) ?? 0) + (javaNumber(paddingRight) ?? 0);
	}

	const CHILD_READS = [
		'getVisibility',
		'getWidth',
		'getHeight',
		'getLeft',
		'getRight',
		'getTop',
		'getBottom',
	];

	async function contentArea(row: NativeJavaReference): Promise<Edges | undefined> {
		const [accessories] = await directChildren(row, AndroidClass.accessories);

		if (!accessories) return;

		const kids = await directChildren(accessories, 'android.view.View');
		const values = await runOnMain(java, [
			...readCalls(accessories, ['getLeft', 'getTop']),
			...kids.flatMap((child) => readCalls(child, CHILD_READS)),
		]);
		const measured = kids.map((child, index) => {
			const [visibility, width, height, left, right, top, bottom] = values
				.slice(2 + index * CHILD_READS.length, 2 + (index + 1) * CHILD_READS.length)
				.map((value) => javaNumber(value) ?? 0);

			return { child, visibility, width, height, left, right, top, bottom };
		});
		const shown = measured.filter(
			(child) => child.visibility === VISIBLE && child.width > 0 && child.height > 0,
		);
		const only =
			shown.length === 1 && isInstance(contentClass, shown[0]!.child) ? shown[0] : undefined;
		const tightRight = only
			? Math.min(only.right, only.left + (await textWidth(only.child, only.width)))
			: undefined;
		const area = union(
			shown.map((child) => ({
				left: child.left,
				top: child.top,
				right: child === only ? tightRight! : child.right,
				bottom: child.bottom,
			})),
		);

		if (!area) return;

		const x = javaNumber(values[0]) ?? 0;
		const y = javaNumber(values[1]) ?? 0;

		noteContentStart(row, area.left + x);

		return {
			left: Math.min(area.left + x, contentStart),
			top: area.top + y,
			right: area.right + x,
			bottom: area.bottom + y,
		};
	}

	async function isNested(row: NativeJavaReference): Promise<boolean> {
		const [outer] = await java.findViews!(row, AndroidClass.messageView, {
			direction: 'ancestors',
			maxDepth: MAX_ANCESTORS,
			maxResults: 1,
			stopAtMatch: true,
		});

		return !!javaReference(outer);
	}

	async function density(row: NativeJavaReference): Promise<number> {
		const resources = javaReference(await java.invokeAsync(row, 'getResources', []));
		const metrics = resources
			? javaReference(java.invoke(resources, 'getDisplayMetrics', []))
			: null;

		return metrics ? (javaNumber(java.getField(metrics, 'density')) ?? 1) : 1;
	}

	async function headerBottom(row: NativeJavaReference): Promise<number | undefined> {
		const header = await viewByIdNameAsync(java, row, 'header');

		if (!header) return;

		const [visibility, height, bottom] = (
			await runOnMain(java, readCalls(header, ['getVisibility', 'getHeight', 'getBottom']))
		).map((value) => javaNumber(value) ?? 0);

		return visibility === VISIBLE && height! > 0 ? bottom : undefined;
	}

	function track(row: NativeJavaReference) {
		if (tracked.some((entry) => sameJavaReference(entry, row))) return;

		tracked.push(row);

		if (tracked.length > MAX_TRACKED) tracked.shift();
	}

	async function restore(row: NativeJavaReference) {
		const drawn = javaReference(java.getAssociatedObject(row, ours));

		if (!drawn) return;

		const background = javaReference(java.getAssociatedObject(row, original));

		java.setAssociatedObject(row, ours, { type: 'null' });
		await java.invokeAsync(row, 'setBackground', [
			background ?? { type: 'null', class: 'android.graphics.drawable.Drawable' },
		]);
	}

	function messageId(row: NativeJavaReference): string | undefined {
		try {
			return javaText(java.getField(row, idField));
		} catch {
			return undefined;
		}
	}

	async function place(row: NativeJavaReference) {
		const area = await contentArea(row);

		if (!area) return restore(row);

		const scale = await density(row);
		const [rowWidth, rowHeight, currentBackground] = await runOnMain(
			java,
			readCalls(row, ['getWidth', 'getHeight', 'getBackground']),
		);
		const style = currentAppearance();
		const frame = bubbleFrame(
			{
				x: area.left,
				y: area.top,
				width: area.right - area.left,
				height: area.bottom - area.top,
			},
			0,
			{
				horizontal: style.horizontalPadding * scale,
				vertical: style.verticalPadding * scale,
			},
			await headerBottom(row),
		);
		const insets = rowInsets(frame, javaNumber(rowWidth) ?? 0, javaNumber(rowHeight) ?? 0);
		const shape = java.construct('android.graphics.drawable.GradientDrawable', []);

		java.invoke(shape, 'setCornerRadius', [javaFloat(style.radius * scale)]);
		java.invoke(shape, 'setColor', [
			javaInt(argb(isOwnMessage(messageId(row)) ? style.ownColor : style.color)),
		]);

		const bubble = java.construct('android.graphics.drawable.LayerDrawable', [
			{ type: 'array', componentType: 'android.graphics.drawable.Drawable', value: [shape] },
		]);

		java.invoke(bubble, 'setLayerInset', [
			javaInt(0),
			javaInt(insets.left),
			javaInt(insets.top),
			javaInt(insets.right),
			javaInt(insets.bottom),
		]);
		java.invoke(bubble, 'setPadding', [javaInt(0), javaInt(0), javaInt(0), javaInt(0)]);
		const current = javaReference(currentBackground);
		const drawn = javaReference(java.getAssociatedObject(row, ours));

		if (!drawn || !current || !sameJavaReference(current, drawn)) {
			java.setAssociatedObject(row, original, current ?? { type: 'null' });
		}

		java.setAssociatedObject(row, ours, bubble);
		track(row);
		await java.invokeAsync(row, 'setBackground', [bubble]);
	}

	async function flush() {
		scheduled = false;

		for (const row of pending.splice(0)) {
			if (disposed) return;

			await place(row).catch((error) => {
				console.error(`[${PLUGIN_NAME}] Failed to place a bubble:`, error);
			});
		}
	}

	function schedule(row: NativeJavaReference) {
		if (disposed || pending.some((entry) => sameJavaReference(entry, row))) return;

		pending.push(row);

		if (!scheduled) {
			scheduled = true;
			setTimeout(() => void flush(), 0);
		}
	}

	async function scheduleRow(accessories: NativeJavaReference) {
		const row = javaReference(await java.invokeAsync(accessories, 'getParent', []));

		if (row && isInstance(messageClass, row) && !(await isNested(row))) schedule(row);
	}

	const token = hooks.hook(
		AndroidClass.recycler,
		'onLayout',
		LAYOUT_PARAMETERS,
		{ notify: true },
		({ self }) => {
			const accessories = javaReference(self);

			if (!accessories || !isInstance(accessoriesClass, accessories)) return;

			void scheduleRow(accessories).catch((error) => {
				console.error(`[${PLUGIN_NAME}] Failed to find a bubble's row:`, error);
			});
		},
	);

	async function refreshVisible() {
		const root = currentDecorView(java);

		if (!root) return;

		for (const row of await findViewsOfClass(java, root, AndroidClass.messageView)) {
			if (!(await isNested(row))) schedule(row);
		}
	}

	refreshVisible().catch((error) =>
		console.error(`[${PLUGIN_NAME}] Failed to scan the views on screen:`, error),
	);

	return {
		placed: () => tracked.length,
		refresh() {
			for (const row of tracked) schedule(row);

			refreshVisible().catch((error) =>
				console.error(`[${PLUGIN_NAME}] Failed to scan the views on screen:`, error),
			);
		},
		async dispose() {
			disposed = true;
			hooks.remove(token);
			pending.length = 0;

			await Promise.all(
				tracked.splice(0).map((row) =>
					restore(row).catch((error) => {
						console.error(`[${PLUGIN_NAME}] Failed to restore a row:`, error);
					}),
				),
			);
		},
	};
}

export default { drawAndroidBubbles };
