import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';
import { findVisibleCells } from '@unbound-plugins/shared/native/visible-cells';
import { readRect } from '@unbound-plugins/shared/native/rect';
import { viewKey } from '@unbound-plugins/shared/native/view-key';
import { readNativeMessageInfo } from '@unbound-plugins/shared/native/message-info';

import { messageLayout, type SnapshotNode } from '~/message-layout';
import { IOSClass, PLUGIN_NAME } from '~/constants';
import { bubbleFrame } from '~/geometry';
import type { BubbleColor } from '~/style';
import { currentAppearance } from '~/theme';
import { messageOwnership } from '~/author';

const SNAPSHOT = { maxDepth: 12, maxNodes: 512 };
const TEXT_MEASURE_HEIGHT = 100_000;
const USES_LINE_FRAGMENT_ORIGIN = 1;

function clearColor(objc: NativeObjCBridge) {
	return objc.call(objc.getClass('UIColor')!, 'clearColor') as NativeObjectHandle;
}

async function textWidth(
	objc: NativeObjCBridge,
	view: NativeObjectHandle,
	limit: number,
): Promise<number> {
	const text = (await objc.invokeAsync(view, 'attributedText', [])) as NativeObjectHandle | null;

	if (!text) return 0;

	const measured = await objc.invokeAsync(text, 'boundingRectWithSize:options:context:', [
		objc.struct('CGSize', { width: limit, height: TEXT_MEASURE_HEIGHT }),
		USES_LINE_FRAGMENT_ORIGIN,
		null,
	]);

	return Math.ceil(readRect(measured).width);
}

type PendingCell = { cell: NativeObjectHandle; onlyWhenResized: boolean };

/**
 * @description Draws a rounded bubble behind each iOS message, sized to its text and media.
 * @param objc The Objective-C bridge.
 * @returns `refresh`, which repaints the bubbles on screen, and `dispose`, which removes them.
 */
export function drawIOSBubbles(objc: NativeObjCBridge) {
	const bubbles = new Map<string, { cell: NativeObjectHandle; bubble: NativeObjectHandle }>();
	const pending = new Map<string, PendingCell>();
	const placedSizes = new Map<string, string>();
	const ownership = new Map<string, boolean>();
	const clear = clearColor(objc);
	let flushing = false;
	let disposed = false;

	function color({ red, green, blue, alpha }: BubbleColor) {
		return objc.call(
			objc.getClass('UIColor')!,
			'colorWithRed:green:blue:alpha:',
			red,
			green,
			blue,
			alpha,
		) as NativeObjectHandle;
	}

	async function bubbleFor(key: string, cell: NativeObjectHandle): Promise<NativeObjectHandle> {
		const existing = bubbles.get(key);

		if (existing) return existing.bubble;

		const bubble = objc.alloc('UIView');
		const layer = (await objc.invokeAsync(bubble, 'layer', [])) as NativeObjectHandle;

		bubbles.set(key, { cell, bubble });
		await objc.invokeAsync(layer, 'setMasksToBounds:', [true]);
		await objc.invokeAsync(bubble, 'setUserInteractionEnabled:', [false]);
		await objc.invokeAsync(cell, 'insertSubview:atIndex:', [bubble, 0]);

		return bubble;
	}

	async function isNested(cell: NativeObjectHandle): Promise<boolean> {
		const parent = (await objc.invokeAsync(cell, 'superview', [])) as NativeObjectHandle | null;

		if (!parent) return false;

		const [outer] = await objc.findViews(parent, IOSClass.messageCell, {
			direction: 'ancestors',
			maxDepth: 24,
			maxResults: 1,
			stopAtMatch: true,
		});

		return Boolean(outer);
	}

	async function sizeOf(cell: NativeObjectHandle): Promise<string> {
		const { width, height } = readRect(await objc.invokeAsync(cell, 'bounds', []));

		return `${Math.round(width)}x${Math.round(height)}`;
	}

	async function isOwn(key: string, cell: NativeObjectHandle): Promise<boolean> {
		const known = ownership.get(key);

		if (known !== undefined) return known;

		const info = await readNativeMessageInfo(cell, objc).catch(() => undefined);

		const own = messageOwnership(info?.messageId, info?.channelId);

		if (own !== undefined) ownership.set(key, own);

		return own ?? false;
	}

	async function place(key: string, { cell, onlyWhenResized }: PendingCell) {
		const size = await sizeOf(cell);

		if (onlyWhenResized && bubbles.has(key) && placedSizes.get(key) === size) return;

		placedSizes.set(key, size);

		if (await isNested(cell)) return;

		const nodes = (await objc.snapshot(cell, SNAPSHOT)) as SnapshotNode[];

		if (disposed) return;

		const layout = messageLayout(nodes);

		if (!layout) {
			const existing = bubbles.get(key);

			if (existing) await objc.invokeAsync(existing.bubble, 'setHidden:', [true]);

			return;
		}

		const textView = layout.text ? nodes[layout.text.index]?.view : undefined;
		const text = textView
			? layout.text!.offset + (await textWidth(objc, textView, layout.body.width))
			: 0;
		const style = currentAppearance();
		const frame = bubbleFrame(
			layout.body,
			Math.max(text, layout.mediaRight),
			{ horizontal: style.horizontalPadding, vertical: style.verticalPadding },
			layout.headerBottom,
		);
		const bubble = await bubbleFor(key, cell);
		const layer = (await objc.invokeAsync(bubble, 'layer', [])) as NativeObjectHandle;

		await objc.invokeAsync(layer, 'setCornerRadius:', [style.radius]);
		const own = await isOwn(key, cell);

		await objc.invokeAsync(bubble, 'setBackgroundColor:', [
			color(own ? style.ownColor : style.color),
		]);
		await objc.invokeAsync(bubble, 'setFrame:', [
			objc.struct('CGRect', {
				origin: { x: frame.x, y: frame.y },
				size: { width: frame.width, height: frame.height },
			}),
		]);
		await objc.invokeAsync(bubble, 'setHidden:', [false]);
	}

	async function flush() {
		flushing = true;

		try {
			while (pending.size && !disposed) {
				const [key, queued] = pending.entries().next().value!;

				pending.delete(key);
				await place(key, queued).catch((error) => {
					console.error(`[${PLUGIN_NAME}] Failed to place a bubble:`, error);
				});
			}
		} finally {
			flushing = false;
		}
	}

	function schedule(cell: NativeObjectHandle, onlyWhenResized = false) {
		const key = viewKey(objc, cell);

		if (disposed || key === undefined) return;

		const queued = pending.get(key);

		pending.set(key, {
			cell,
			onlyWhenResized: onlyWhenResized && (queued?.onlyWhenResized ?? true),
		});

		if (!flushing) setTimeout(() => void flush(), 0);
	}

	const hooks = [
		objc.hook(IOSClass.messageCell, 'setBackgroundColor:', {
			before: (context) => context.replaceObjectArgument(0, clear),
		}),
		objc.hook(IOSClass.separatorCell, 'setBackgroundColor:', {
			before: (context) => context.replaceObjectArgument(0, clear),
		}),
		objc.hook(IOSClass.messageCell, 'layoutSubviews', {
			after: ({ self }) => schedule(self, true),
		}),
		objc.hook(IOSClass.messageCell, 'prepareForReuse', {
			after: ({ self }) => {
				const key = viewKey(objc, self);

				if (key !== undefined) {
					placedSizes.delete(key);
					ownership.delete(key);
				}

				schedule(self);
			},
		}),
	];

	async function refresh() {
		for (const className of [IOSClass.messageCell, IOSClass.separatorCell]) {
			for (const cell of await findVisibleCells(objc, className)) {
				await objc.invokeAsync(cell, 'setBackgroundColor:', [clear]);

				if (className === IOSClass.messageCell) schedule(cell);
			}
		}
	}

	void refresh();

	return {
		placed: () => bubbles.size,
		refresh: () => void refresh(),
		async dispose() {
			disposed = true;

			for (const hook of hooks) hook.remove();

			pending.clear();
			placedSizes.clear();
			ownership.clear();
			await Promise.all(
				[...bubbles.values()].map(({ bubble }) =>
					objc.invokeAsync(bubble, 'removeFromSuperview', []).catch(() => undefined),
				),
			);
			bubbles.clear();
		},
	};
}

export default { drawIOSBubbles };
