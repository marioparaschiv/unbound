import { isCancellation } from '@unbound-plugins/shared/native/cancellation';
import type {
	NativeObjCBridge,
	NativeObjectHandle,
	NativePluginBridge,
} from '@unbound-app/api/native';
import { LATEST_CALL_PER_RECEIVER } from '@unbound-plugins/shared/native/ios/hook-options';
import { findVisibleCells } from '@unbound-plugins/shared/native/ios/visible-cells';
import { MESSAGE_TEXT_VIEW_CLASSES } from '@unbound-plugins/shared/native/ios/text-attachments';
import { readRect } from '@unbound-plugins/shared/native/ios/rect';
import { viewKey } from '@unbound-plugins/shared/native/ios/view-key';
import { readNativeMessageInfo } from '@unbound-plugins/shared/native/ios/message-info';

import { messageLayout, type SnapshotNode } from '~/lib/message-layout';
import { drawBubble, forgetBubbles, installBubbleGuards } from '~/native/worklets-ios';
import { BubbleLayout, CARD_INSET, IOSClass } from '~/constants';
import { bubbleFrame, bubbleProblem, cardFrame, frameDrift } from '~/lib/geometry';
import { currentAppearance } from '~/lib/theme';
import { messageOwnership } from '~/lib/author';
import {
	createDrawnSignatures,
	needsSettle,
	noteChange,
	notePlaced,
	startSettle,
	type ReuseSettle,
} from '~/lib/reuse-settle';

const SNAPSHOT = { maxDepth: 12, maxNodes: 512 };
const BUBBLE_TAG = 0x0b0b1e;
const FRAME_TOLERANCE = 2;
const MAX_NESTED_CHECKS = 256;

function describeBox({
	x,
	y,
	width,
	height,
}: {
	x: number;
	y: number;
	width: number;
	height: number;
}) {
	return [x, y, width, height].map((value) => Math.round(value)).join(',');
}
const REUSE_SETTLE_MS = 150;
const MEASURE_RETRIES = 3;
const MEASURE_RETRY_MS = 250;
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
	const [text, measured] = await objc
		.batch([
			{ target: view, selector: 'attributedText', args: [] },
			{
				target: { $nativeBatchResult: 0 },
				selector: 'boundingRectWithSize:options:context:',
				args: [
					objc.struct('CGSize', { width: limit, height: TEXT_MEASURE_HEIGHT }),
					USES_LINE_FRAGMENT_ORIGIN,
					null,
				],
			},
		])
		.catch(() => [null, null]);

	return text ? Math.ceil(readRect(measured).width) : 0;
}

type PendingCell = { cell: NativeObjectHandle; onlyWhenResized: boolean };

type NestedCheck = { parent: string | undefined; nested: boolean };

/**
 * @description Draws a rounded bubble behind each iOS message, sized to its text and media, or in the card layout one card behind its whole content column.
 * @param objc The Objective-C bridge.
 * @returns `refresh`, which repaints the bubbles on screen, and `dispose`, which removes them.
 */
export function drawIOSBubbles({ objc, ui }: NativePluginBridge) {
	const scope = ui.createScope();
	const bubbles = new Map<string, { cell: NativeObjectHandle; bubble: NativeObjectHandle }>();
	const pending = new Map<string, PendingCell>();
	const placedSizes = new Map<string, string>();
	const failedMeasures = new Map<string, number>();
	const ownership = new Map<string, boolean>();
	const problems = new Map<string, string>();
	const nested = new Map<string, NestedCheck>();
	const settlingReuse = new Map<string, ReuseSettle>();
	const drawnBubbles = createDrawnSignatures();
	const clear = clearColor(objc);
	let flushing = false;
	let disposed = false;

	async function bubbleFor(key: string, cell: NativeObjectHandle): Promise<NativeObjectHandle> {
		const existing = bubbles.get(key);

		if (existing) return existing.bubble;

		const adopted = (await objc.invokeAsync(cell, 'viewWithTag:', [
			BUBBLE_TAG,
		])) as NativeObjectHandle | null;

		if (adopted) {
			bubbles.set(key, { cell, bubble: adopted });

			return adopted;
		}

		const bubble = objc.alloc('UIView');

		bubbles.set(key, { cell, bubble });
		await objc.batch([
			{ target: bubble, selector: 'setTag:', args: [BUBBLE_TAG] },
			{ target: bubble, selector: 'setHidden:', args: [true] },
			{ target: bubble, selector: 'setUserInteractionEnabled:', args: [false] },
			{ target: bubble, selector: 'layer', args: [] },
			{ target: { $nativeBatchResult: 3 }, selector: 'setMasksToBounds:', args: [true] },
			{ target: cell, selector: 'insertSubview:atIndex:', args: [bubble, 0] },
		]);

		if (disposed) await objc.invokeAsync(bubble, 'removeFromSuperview', []);

		return bubble;
	}

	async function isNested(key: string, cell: NativeObjectHandle): Promise<boolean> {
		const parent = (await objc.invokeAsync(cell, 'superview', [])) as NativeObjectHandle | null;

		if (!parent) return false;

		const parentKey = viewKey(objc, parent);
		const known = nested.get(key);

		if (known && parentKey !== undefined && known.parent === parentKey) return known.nested;

		const [outer] = await objc.findViews(parent, IOSClass.messageCell, {
			direction: 'ancestors',
			maxDepth: 24,
			maxResults: 1,
			stopAtMatch: true,
		});

		nested.delete(key);
		nested.set(key, { parent: parentKey, nested: Boolean(outer) });

		if (nested.size > MAX_NESTED_CHECKS) nested.delete(nested.keys().next().value!);

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

	async function measure(cell: NativeObjectHandle) {
		const nodes = (await objc.snapshot(cell, SNAPSHOT)) as SnapshotNode[];
		const layout = messageLayout(nodes);

		if (!layout) return;

		const style = currentAppearance();

		if (style.layout === BubbleLayout.card) {
			return {
				frame: cardFrame(layout.column, CARD_INSET),
				contentWidth: layout.column.width,
			};
		}

		const textView = layout.text ? nodes[layout.text.index]?.view : undefined;
		const text = textView
			? layout.text!.offset + (await textWidth(objc, textView, layout.body.width))
			: 0;
		const contentWidth = Math.max(text, layout.footerRight ?? 0, layout.mediaRight);
		const frame = bubbleFrame(
			layout.body,
			contentWidth,
			{ horizontal: style.horizontalPadding, vertical: style.verticalPadding },
			layout.headerBottom,
		);

		return { frame, contentWidth };
	}

	async function missingBubbles(): Promise<string[]> {
		const found: string[] = [];

		for (const cell of await findVisibleCells(objc, IOSClass.messageCell)) {
			const key = viewKey(objc, cell);

			if (key === undefined || pending.has(key) || (await isNested(key, cell))) continue;

			const bubble = bubbles.get(key)?.bubble;
			const shown = bubble && !(await objc.invokeAsync(bubble, 'isHidden', []));

			if (!shown && (await measure(cell).catch(() => undefined))) {
				found.push(`${key} has no bubble`);
			}
		}

		return found;
	}

	async function staleBubbles(): Promise<string[]> {
		const found: string[] = [];

		for (const [key, { cell, bubble }] of bubbles) {
			if (pending.has(key) || (await objc.invokeAsync(bubble, 'isHidden', []))) continue;

			const measured = await measure(cell).catch(() => undefined);

			if (!measured) continue;

			const drawn = readRect(await objc.invokeAsync(bubble, 'frame', []));

			if (frameDrift(drawn, measured.frame) > FRAME_TOLERANCE) {
				found.push(
					`${key} does not match its message (drawn ${describeBox(drawn)}, needed ${describeBox(measured.frame)})`,
				);
			}
		}

		return found;
	}

	async function place(key: string, { cell, onlyWhenResized }: PendingCell) {
		const size = await sizeOf(cell);

		if (onlyWhenResized && bubbles.has(key) && placedSizes.get(key) === size) return;

		placedSizes.set(key, size);

		notePlaced(settlingReuse.get(key));

		if (await isNested(key, cell)) {
			await objc.invokeAsync(cell, 'setBackgroundColor:', [clear]);

			return;
		}

		const viewModel = objc.getIvar(cell, 'viewModel') as NativeObjectHandle | null;
		const [measured, own] = await Promise.all([measure(cell), isOwn(key, cell)]);

		if (disposed) return;

		if (!measured) {
			const existing = bubbles.get(key);

			drawnBubbles.forget(key);

			if (existing) await objc.invokeAsync(existing.bubble, 'setHidden:', [true]);

			retryMeasure(key, cell);

			return;
		}

		failedMeasures.delete(key);

		const { frame, contentWidth } = measured;
		const style = currentAppearance();
		const problem = bubbleProblem(frame, Number(size.split('x')[0]), contentWidth);

		if (problem) problems.set(key, problem);
		else problems.delete(key);

		const bubble = await bubbleFor(key, cell);

		if (disposed) return;

		const drawn = {
			...frame,
			cellWidth: Number(size.split('x')[0]),
			radius: style.radius,
			color: own ? style.ownColor : style.color,
		};
		if (!drawnBubbles.changed(key, drawn)) return;

		ui.run(drawBubble, key, cell, bubble, viewModel, drawn);
	}

	async function flush() {
		flushing = true;

		try {
			while (pending.size && !disposed) {
				const [key, queued] = pending.entries().next().value!;

				pending.delete(key);
				await place(key, queued).catch((error) => {
					if (!isCancellation(error)) {
						logger.error(`Failed to place a bubble:`, error);
					}
				});
			}
		} finally {
			flushing = false;
		}
	}

	function retryMeasure(key: string, cell: NativeObjectHandle) {
		const failures = (failedMeasures.get(key) ?? 0) + 1;

		failedMeasures.set(key, failures);

		if (failures > MEASURE_RETRIES) return;

		placedSizes.delete(key);
		setTimeout(() => {
			if (!disposed) schedule(cell, false, key);
		}, MEASURE_RETRY_MS);
	}

	function schedule(
		cell: NativeObjectHandle,
		onlyWhenResized = false,
		key: string | undefined = viewKey(objc, cell),
	) {
		if (disposed || key === undefined) return;

		const queued = pending.get(key);

		pending.set(key, {
			cell,
			onlyWhenResized: onlyWhenResized && (queued?.onlyWhenResized ?? true),
		});

		if (!flushing) setTimeout(() => void flush(), 0);
	}

	ui.run(
		installBubbleGuards,
		scope,
		{
			messageCell: IOSClass.messageCell,
			separatorCell: IOSClass.separatorCell,
			bubbleTag: BUBBLE_TAG,
		},
		ui.callback((key: string) => {
			const cell = bubbles.get(key)?.cell;

			drawnBubbles.forget(key);

			if (cell) schedule(cell, false, key);
		}),
	);

	const hooks = [
		objc.hook(
			IOSClass.messageCell,
			'layoutSubviews',
			{
				after: ({ self }) => {
					const key = viewKey(objc, self);

					markSettlingDirty(key);
					schedule(self, true, key);
				},
			},
			LATEST_CALL_PER_RECEIVER,
		),
		...textChangeHooks(),
		objc.hook(IOSClass.messageCell, 'prepareForReuse', {
			after: ({ self }) => {
				const key = viewKey(objc, self);

				if (key === undefined) return;

				placedSizes.delete(key);
				drawnBubbles.forget(key);
				failedMeasures.delete(key);
				ownership.delete(key);
				problems.delete(key);
				pending.delete(key);

				const settle = startSettle();

				settlingReuse.set(key, settle);

				setTimeout(() => {
					if (settlingReuse.get(key) === settle) settlingReuse.delete(key);

					if (!disposed && needsSettle(settle)) schedule(self, false, key);
				}, REUSE_SETTLE_MS);
			},
		}),
	];

	function textChangeHooks() {
		return MESSAGE_TEXT_VIEW_CLASSES.flatMap((className) => {
			try {
				return [
					objc.hook(
						className,
						'setAttributedText:',
						{
							after: ({ self }) =>
								void scheduleOwningCell(self).catch(() => undefined),
						},
						LATEST_CALL_PER_RECEIVER,
					),
				];
			} catch {
				return [];
			}
		});
	}

	async function scheduleOwningCell(view: NativeObjectHandle) {
		if (disposed) return;

		const [cell] = await objc.findViews(view, IOSClass.messageCell, {
			direction: 'ancestors',
			maxDepth: 24,
			maxResults: 1,
			stopAtMatch: true,
		});

		if (!cell) return;

		const key = viewKey(objc, cell as NativeObjectHandle);

		if (key === undefined) return;

		if (noteChange(settlingReuse.get(key))) schedule(cell as NativeObjectHandle, false, key);
	}

	function markSettlingDirty(key: string | undefined) {
		if (key !== undefined) noteChange(settlingReuse.get(key));
	}

	async function refresh() {
		ui.run(forgetBubbles);
		drawnBubbles.clear();
		nested.clear();

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
		settling: () => flushing || pending.size > 0,
		problems: async () => [
			...[...problems].map(([key, problem]) => `${key} ${problem}`),
			...(await staleBubbles()),
			...(await missingBubbles()),
		],
		refresh: (): void => void refresh(),
		async dispose() {
			disposed = true;
			scope.dispose();

			for (const hook of hooks) hook.remove();

			pending.clear();
			placedSizes.clear();
			drawnBubbles.clear();
			failedMeasures.clear();
			ownership.clear();
			problems.clear();
			nested.clear();
			settlingReuse.clear();
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
