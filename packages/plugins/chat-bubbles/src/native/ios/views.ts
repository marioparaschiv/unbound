import { isCancellation } from '@unbound-plugins/shared/native/cancellation';
import type { NativeObjCBridge, NativeObjectHandle, NativeBridge } from '@unbound-app/api/native';
import { LATEST_CALL_PER_RECEIVER } from '@unbound-plugins/shared/native/ios/hook-options';
import { findVisibleCells } from '@unbound-plugins/shared/native/ios/visible-cells';
import { MESSAGE_TEXT_VIEW_CLASSES } from '@unbound-plugins/shared/native/ios/text-attachments';
import { readRect } from '@unbound-plugins/shared/native/ios/rect';
import { viewKey } from '@unbound-plugins/shared/native/ios/view-key';
import { readNativeMessageInfo } from '@unbound-plugins/shared/native/ios/message-info';

import {
	drawBubble,
	forgetBubbles,
	installBubbleGuards,
	restoreCells,
	setCellFallback,
} from '~/native/ios/worklets';
import { CornerCurve, Grouping, IOSClass, SQUARED_CORNER_RATIO } from '~/lib/constants';
import { bubblePath, cornerRadii } from '~/lib/bubble-path';
import { bubbleProblem } from '~/lib/geometry';
import { bubbleTail, cornerShape, withoutTailCorner } from '~/lib/group';
import { createNeighbours } from '~/native/ios/neighbours';
import { createMediaCorners } from '~/native/ios/media-corners';
import { createMentionHighlight, mentionPaint } from '~/native/ios/mention';
import { installRowPadding, setRowRoom } from '~/native/ios/row-padding';
import {
	accessoryGap,
	headingPadding,
	NO_ROW_ROOM,
	rowInset,
	rowRooms,
	type RowRooms,
} from '~/lib/style';
import { resizeRows } from '~/native/ios/resize-rows';
import { installMovedTaps } from '~/native/ios/moved-taps';
import { packInset, removeContentInsets } from '~/native/ios/content-inset';
import { currentAppearance } from '~/lib/theme';
import { messageAuthor, messageOwnership } from '~/lib/author';
import { createBubbleChecks } from '~/native/ios/bubble-checks';
import { createMeasure } from '~/native/ios/measure';
import { cellFallback, cellPaint } from '~/lib/cell-paint';
import { createRowGroups } from '~/lib/row-groups';
import { SelectedChannelStore } from '~/lib/modules';
import {
	createDrawnSignatures,
	needsSettle,
	noteChange,
	notePlaced,
	startSettle,
	type ReuseSettle,
} from '~/lib/reuse-settle';
import { isStandaloneCell } from '~/native/ios/standalone-cell';
import { AVATAR_TAG } from '~/native/ios/ui-cell';

const BUBBLE_TAG = 0x0b0b1e;
const MAX_NESTED_CHECKS = 256;
const REUSE_SETTLE_MS = 150;
const PLACEMENT_WORKERS = 3;
const MEASURE_RETRIES = 3;
const MEASURE_RETRY_MS = 250;

function clearColor(objc: NativeObjCBridge) {
	return objc.call(objc.getClass('UIColor')!, 'clearColor') as NativeObjectHandle;
}

type PendingCell = { cell: NativeObjectHandle; onlyWhenResized: boolean };

type NestedCheck = { parent: string | undefined; nested: boolean };

/** Whether the user sent a message, its author scoped to its channel, whose avatar may differ per server, and its ids. */
type Sender = {
	own: boolean;
	author: string | undefined;
	messageId?: string;
	channelId?: string;
};

/**
 * @description Draws a rounded bubble behind each iOS message, sized to its text and media, or in the card layout one card behind its whole content column.
 * @param objc The Objective-C bridge.
 * @returns `refresh`, which repaints the bubbles on screen, and `dispose`, which removes them.
 */
export function drawIOSBubbles({ objc, ui }: NativeBridge) {
	const scope = ui.createScope();
	const bubbles = new Map<string, { cell: NativeObjectHandle; bubble: NativeObjectHandle }>();
	const pending = new Map<string, PendingCell>();
	const placedSizes = new Map<string, string>();
	const failedMeasures = new Map<string, number>();
	const senders = new Map<string, Sender>();
	const problems = new Map<string, string>();
	const nested = new Map<string, NestedCheck>();
	const settlingReuse = new Map<string, ReuseSettle>();
	const drawnBubbles = createDrawnSignatures();
	const neighbours = createNeighbours(objc, currentAppearance, (cell, key) =>
		schedule(cell, false, key),
	);
	const media = createMediaCorners(objc);
	const highlight = createMentionHighlight(objc);
	const measure = createMeasure({ objc, media, highlight, inset: () => rows.inset });
	const groups = createRowGroups(redrawMessages);
	const clear = clearColor(objc);
	let rows = { rooms: NO_ROW_ROOM, inset: 0, below: 0 };
	/** The cells being placed, which wait in the queue until their current place ends. */
	const placing = new Set<string>();
	let workers = 0;
	let refreshQueued = false;
	let disposed = false;

	async function bubbleFor(key: string, cell: NativeObjectHandle): Promise<NativeObjectHandle> {
		const existing = bubbles.get(key);
		// A stopping instance's last draw can remove this bubble and keep its own, so a detached bubble is dropped for the cell's.
		const parent = existing
			? ((await objc.invokeAsync(
					existing.bubble,
					'superview',
					[],
				)) as NativeObjectHandle | null)
			: null;

		if (existing && parent && objc.call(parent, 'isEqual:', cell)) return existing.bubble;

		bubbles.delete(key);
		drawnBubbles.forget(key);

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

	// The content's offset counts too: the row grows first and its content moves down by half the room on a later layout.
	async function sizeOf(cell: NativeObjectHandle): Promise<string> {
		const [bounds, , content] = await objc.batch([
			{ target: cell, selector: 'bounds', args: [] },
			{ target: cell, selector: 'contentView', args: [] },
			{ target: { $nativeBatchResult: 1 }, selector: 'frame', args: [] },
		]);
		const { width, height } = readRect(bounds);

		return `${Math.round(width)}x${Math.round(height)}@${Math.round(readRect(content).y)}`;
	}

	async function senderOf(key: string, cell: NativeObjectHandle): Promise<Sender> {
		const known = senders.get(key);

		if (known) return known;

		// Discord's native message names no channel, and the chat on screen is the selected channel's.
		const info = await readNativeMessageInfo(
			cell,
			objc,
			() => SelectedChannelStore.getChannelId?.() as string | undefined,
		).catch(() => undefined);
		const own = messageOwnership(info?.messageId, info?.channelId);
		const author = messageAuthor(info?.messageId, info?.channelId);

		if (own === undefined || author === undefined) return { own: false, author: undefined };

		const sender = {
			own,
			author: `${info?.channelId ?? ''}/${author}`,
			messageId: info?.messageId,
			channelId: info?.channelId,
		};

		senders.set(key, sender);

		return sender;
	}

	// A group's edges changed, such as when a new message joins it, so the rows showing those messages are placed again.
	function redrawMessages(ids: string[]) {
		const changed = new Set(ids);

		for (const [key, sender] of senders) {
			const cell = bubbles.get(key)?.cell;

			if (cell && sender.messageId && changed.has(sender.messageId))
				schedule(cell, false, key);
		}
	}

	const checks = createBubbleChecks({
		objc,
		bubbles,
		pending: (key) => pending.has(key),
		isNested,
		measure,
		cleared: neighbours.cleared,
	});

	async function place(key: string, { cell, onlyWhenResized }: PendingCell) {
		const size = await sizeOf(cell);

		if (onlyWhenResized && bubbles.has(key) && placedSizes.get(key) === size) return;

		placedSizes.set(key, size);

		notePlaced(settlingReuse.get(key));

		if (isStandaloneCell(objc, cell)) return;

		if (await isNested(key, cell)) {
			await objc.invokeAsync(cell, 'setBackgroundColor:', [clear]);

			return;
		}

		const viewModel = objc.getIvar(cell, 'viewModel') as NativeObjectHandle | null;
		const [measured, sender] = await Promise.all([measure(cell), senderOf(key, cell)]);

		if (disposed) return;

		if (!measured) {
			const existing = bubbles.get(key);

			drawnBubbles.forget(key);

			if (existing) await objc.invokeAsync(existing.bubble, 'setHidden:', [true]);

			retryMeasure(key, cell);

			return;
		}

		failedMeasures.delete(key);

		const { frame: measuredFrame, height, reach, contentWidth, startsGroup, radius } = measured;

		await media.apply(measured.mediaViews, measured.mediaRadius);

		// The channel's data knows the messages off screen too, so it decides where a group ends; the rows on screen are the fallback.
		const data = groups.place(sender.channelId, sender.messageId);
		// Reactions sit between a bubble and the next one of its group, so the bubble stretches only down to them.
		const { frame, corners, start, end, fillets } = await neighbours.fit(
			key,
			cell,
			measuredFrame,
			height,
			data ?? { start: startsGroup },
			reach,
		);
		const style = currentAppearance();
		const edges = { start, end };

		const problem = bubbleProblem(frame, Number(size.split('x')[0]), contentWidth);

		if (problem) problems.set(key, problem);
		else problems.delete(key);

		const bubble = await bubbleFor(key, cell);

		if (disposed) return;

		const tail = bubbleTail(style.tail, { start, end });
		const color = sender.own ? style.ownColor : style.color;
		const shape = cornerShape(
			radius,
			frame.width,
			frame.height,
			style.cornerCurve === CornerCurve.continuous,
		);
		const rounded = withoutTailCorner(corners, tail);
		// Joined bubbles touch, so their joins stay square to meet as one shape.
		const squared =
			style.grouping === Grouping.joined ? 0 : shape.radius * SQUARED_CORNER_RATIO;
		const radii = cornerRadii(rounded, shape.radius, squared, tail);
		const tailSize = tail ? Math.min(style.tailSize, frame.height / 2) : 0;
		const drawn = {
			...frame,
			cellWidth: Number(size.split('x')[0]),
			...shape,
			path: bubblePath(
				frame.width,
				frame.height,
				radii,
				shape.continuous,
				tail && { side: tail, size: tailSize },
			),
			corners: rounded,
			tailSize,
			fillets,
			blur: style.blur,
			...(measured.mention
				? mentionPaint(color, measured.mention, style.mention)
				: { color }),
			paint: cellPaint(
				measured,
				frame,
				headingPadding(style),
				color,
				style.avatarLast && sender.author !== undefined
					? { author: sender.author, ...edges }
					: undefined,
			),
		};

		if (!drawnBubbles.changed(key, drawn)) return;

		ui.run(drawBubble, key, cell, bubble, viewModel, drawn);
	}

	// A cell never placed since it was reused shows no bubble while the list scrolls, so it goes before cells that only check their size.
	function takeNext(): [string, PendingCell] | undefined {
		let next: [string, PendingCell] | undefined;

		for (const entry of pending) {
			if (placing.has(entry[0])) continue;

			if (!entry[1].onlyWhenResized || !placedSizes.has(entry[0])) {
				next = entry;
				break;
			}

			next ??= entry;
		}

		if (next) pending.delete(next[0]);

		return next;
	}

	// Several workers place cells at once, each waiting on the main thread in turn, so one slow cell holds up no other.
	async function work() {
		workers++;

		try {
			for (let next = takeNext(); next && !disposed; next = takeNext()) {
				const [key, queued] = next;

				placing.add(key);
				await place(key, queued)
					.catch((error) => {
						if (!isCancellation(error)) {
							logger.error(`Failed to place a bubble:`, error);
						}
					})
					.finally(() => placing.delete(key));
			}
		} finally {
			workers--;
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

		if (workers < PLACEMENT_WORKERS) void work();
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

	ui.run(installRowPadding, scope, IOSClass.messageCell, IOSClass.contentView, [
		BUBBLE_TAG,
		AVATAR_TAG,
	]);
	ui.run(installMovedTaps, scope, IOSClass.messageCell);

	async function setRows(next: { rooms: RowRooms; inset: number; below: number }) {
		if (JSON.stringify(next) === JSON.stringify(rows)) return;

		rows = next;
		ui.run(setRowRoom, next.rooms, packInset(next.inset, next.below));
		await resizeRows(objc).catch((error) => {
			if (!isCancellation(error)) logger.error(`Failed to resize the chat rows:`, error);
		});
	}

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
				senders.delete(key);
				problems.delete(key);
				pending.delete(key);
				neighbours.forget(key);

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

	// The UI thread draws bubbles into cells this side never saw, so stopping also clears them from every cell on screen.
	async function removeUntracked() {
		for (const cell of await findVisibleCells(objc, IOSClass.messageCell)) {
			for (let bubble = await tagged(cell); bubble; bubble = await tagged(cell)) {
				await objc.invokeAsync(bubble, 'removeFromSuperview', []);
			}
		}
	}

	async function tagged(cell: NativeObjectHandle) {
		return (await objc.invokeAsync(cell, 'viewWithTag:', [
			BUBBLE_TAG,
		])) as NativeObjectHandle | null;
	}

	// Settings change one key at a time, so a burst of changes refreshes once, after the last.
	function requestRefresh() {
		if (refreshQueued) return;

		refreshQueued = true;
		setTimeout(() => {
			refreshQueued = false;

			if (!disposed) void refresh();
		}, 0);
	}

	// Rows resize before any bubble is measured, so none is fitted to a row Discord has not laid out again yet.
	async function refresh() {
		const style = currentAppearance();

		await setRows({
			rooms: rowRooms(style),
			inset: rowInset(style),
			below: accessoryGap(style),
		});

		if (disposed) return;

		ui.run(setCellFallback, cellFallback(style));
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
		settling: () => workers > 0 || pending.size > 0,
		problems: async () => [
			...[...problems].map(([key, problem]) => `${key} ${problem}`),
			...(await checks.stale()),
			...(await checks.missing()),
		],
		refresh: requestRefresh,
		async dispose() {
			disposed = true;
			await setRows({ rooms: NO_ROW_ROOM, inset: 0, below: 0 });
			const cells = await findVisibleCells(objc, IOSClass.messageCell);

			await removeContentInsets(objc, cells);
			ui.run(restoreCells, [...cells, ...[...bubbles.values()].map(({ cell }) => cell)]);
			ui.run(forgetBubbles);
			await removeUntracked().catch(() => undefined);
			scope.dispose();

			for (const hook of hooks) hook.remove();

			pending.clear();
			placedSizes.clear();
			drawnBubbles.clear();
			failedMeasures.clear();
			senders.clear();
			problems.clear();
			nested.clear();
			settlingReuse.clear();
			neighbours.clear();
			await media.restore().catch(() => undefined);
			await highlight.restore().catch(() => undefined);
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
