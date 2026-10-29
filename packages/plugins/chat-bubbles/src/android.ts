import type {
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeJavaReference,
} from '@unbound-app/api/native';
import { currentDecorView, findViewsOfClass } from '@unbound-plugins/shared/native/android/views';
import {
	javaFlag,
	javaFloat,
	javaInt,
	javaNumber,
	javaReference,
	sameJavaReference,
} from '@unbound-plugins/shared/native/android/java-values';

import { bubbleFrame, rowInsets, union, type Edges } from '~/geometry';
import { AndroidClass, BubbleStyle, PLUGIN_NAME } from '~/constants';
import { argb, bubbleColor } from '~/theme';

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
	const contentClass = java.getClass(AndroidClass.content);
	const ours = java.createAssociationKey();
	const original = java.createAssociationKey();
	const tracked: NativeJavaReference[] = [];
	const pending: NativeJavaReference[] = [];
	let scheduled = false;
	let disposed = false;

	const number = (view: NativeJavaReference, method: string) =>
		javaNumber(java.invoke(view, method, [])) ?? 0;
	const isInstance = (type: NativeJavaReference, view: NativeJavaReference) =>
		javaFlag(java.invoke(type, 'isInstance', [view]));

	function children(group: NativeJavaReference): NativeJavaReference[] {
		const count = number(group, 'getChildCount');

		return Array.from({ length: count }, (_, index) =>
			javaReference(java.invoke(group, 'getChildAt', [javaInt(index)])),
		).filter((child): child is NativeJavaReference => Boolean(child));
	}

	function textWidth(view: NativeJavaReference): number {
		const layout = javaReference(java.invoke(view, 'getLayout', []));

		if (!layout) return number(view, 'getWidth');

		let widest = 0;

		for (let line = 0; line < number(layout, 'getLineCount'); line++) {
			widest = Math.max(
				widest,
				javaNumber(java.invoke(layout, 'getLineWidth', [javaInt(line)])) ?? 0,
			);
		}

		return (
			Math.ceil(widest) +
			number(view, 'getTotalPaddingLeft') +
			number(view, 'getTotalPaddingRight')
		);
	}

	function contentArea(row: NativeJavaReference): Edges | undefined {
		const accessories = children(row).find((child) => isInstance(accessoriesClass, child));

		if (!accessories) return;

		const shown = children(accessories).filter(
			(child) =>
				number(child, 'getVisibility') === VISIBLE &&
				number(child, 'getWidth') > 0 &&
				number(child, 'getHeight') > 0,
		);
		const area = union(
			shown.map((child) => {
				const left = number(child, 'getLeft');
				const right = number(child, 'getRight');
				const tightened =
					shown.length === 1 && isInstance(contentClass, child)
						? Math.min(right, left + textWidth(child))
						: right;

				return {
					left,
					top: number(child, 'getTop'),
					right: tightened,
					bottom: number(child, 'getBottom'),
				};
			}),
		);

		if (!area) return;

		const x = number(accessories, 'getLeft');
		const y = number(accessories, 'getTop');

		return {
			left: area.left + x,
			top: area.top + y,
			right: area.right + x,
			bottom: area.bottom + y,
		};
	}

	function isNested(row: NativeJavaReference): boolean {
		let current = javaReference(java.invoke(row, 'getParent', []));

		for (let depth = 0; current && depth < MAX_ANCESTORS; depth++) {
			if (isInstance(messageClass, current)) return true;

			current = javaReference(java.invoke(current, 'getParent', []));
		}

		return false;
	}

	function density(row: NativeJavaReference): number {
		const resources = javaReference(java.invoke(row, 'getResources', []));
		const metrics = resources
			? javaReference(java.invoke(resources, 'getDisplayMetrics', []))
			: null;

		return metrics ? (javaNumber(java.getField(metrics, 'density')) ?? 1) : 1;
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

	async function place(row: NativeJavaReference) {
		const area = contentArea(row);

		if (!area) return restore(row);

		const scale = density(row);
		const frame = bubbleFrame(
			{
				x: area.left,
				y: area.top,
				width: area.right - area.left,
				height: area.bottom - area.top,
			},
			0,
			scale,
		);
		const insets = rowInsets(frame, number(row, 'getWidth'), number(row, 'getHeight'));
		const shape = java.construct('android.graphics.drawable.GradientDrawable', []);

		java.invoke(shape, 'setCornerRadius', [javaFloat(BubbleStyle.radius * scale)]);
		java.invoke(shape, 'setColor', [javaInt(argb(bubbleColor()))]);

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
		const current = javaReference(java.invoke(row, 'getBackground', []));
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

	const token = hooks.hook(
		AndroidClass.recycler,
		'onLayout',
		LAYOUT_PARAMETERS,
		{ notify: true },
		({ self }) => {
			const accessories = javaReference(self);

			if (!accessories || !isInstance(accessoriesClass, accessories)) return;

			const row = javaReference(java.invoke(accessories, 'getParent', []));

			if (row && isInstance(messageClass, row) && !isNested(row)) schedule(row);
		},
	);

	function refreshVisible() {
		const root = currentDecorView(java);

		if (!root) return;

		for (const row of findViewsOfClass(java, root, AndroidClass.messageView)) {
			if (!isNested(row)) schedule(row);
		}
	}

	refreshVisible();

	return {
		refresh() {
			for (const row of tracked) schedule(row);

			refreshVisible();
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
