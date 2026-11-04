import { isCancellation } from '@unbound-plugins/shared/native/cancellation';
import type {
	NativeJavaBatchOperation,
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeJavaReference,
	NativeJavaValue,
	NativeUIBridge,
} from '@unbound-app/api/native';
import {
	currentDecorView,
	displayDensity,
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
	javaString,
	javaText,
	sameJavaReference,
} from '@unbound-plugins/shared/native/android/java-values';
import {
	messageBindMethod,
	messageIdField,
	viewByIdNameAsync,
} from '@unbound-plugins/shared/native/android/discord-views';

import {
	bubbleFrame,
	bubbleProblem,
	cardFrame,
	columnEndFrom,
	isLaidOut,
	rowContentStart,
	rowInsets,
	union,
	type Box,
	type Edges,
} from '~/geometry';
import { AndroidClass, BubbleLayout, CARD_INSET, PLUGIN_NAME } from '~/constants';
import { forgetBubbles, installBindGuard, rememberBubble } from '~/android/ui-bubbles';
import { currentAppearance } from '~/theme';
import { argb } from '~/style';
import { isOwnMessage } from '~/author';
import { RECEIVER_ONLY_AFTER_CALL } from '@unbound-plugins/shared/native/android/hook-options';

type AndroidNative = {
	java: NativeJavaBridge;
	hooks: NativeJavaHooksBridge;
	ui: NativeUIBridge;
};

const MAX_TRACKED = 256;

type PlacedRow = {
	width: number;
	height: number;
	revision: number;
};
const MAX_ANCESTORS = 16;
const VISIBLE = 0;
const ICON_SPACING_DP = 4;
const BUBBLE_LAYER_ID = 0x0b0b1e;
const MESSAGE_ID_GETTER = 'getId-3Eiw7ao';
const BIND_SETTLE_MS = 50;
const PLACEMENT_WORKERS = 8;
const LAYOUT_PARAMETERS = ['boolean', 'int', 'int', 'int', 'int'];
const MATCH_PARENT = -1;

/**
 * @description Draws a rounded bubble behind each Android message as the row's background, sized to its content or, in the card layout, covering its whole content column, without changing the row's padding.
 * @param native The plugin's Java and hook bridges.
 * @returns `refresh`, which repaints the bubbles it drew, and `dispose`, which brings back the rows' own backgrounds.
 */
export function drawAndroidBubbles({ java, hooks, ui }: AndroidNative) {
	const messageClass = java.getClass(AndroidClass.messageView);
	const idField = messageIdField(java);
	const bindMessage = messageBindMethod(java);
	const contentClass = java.getClass(AndroidClass.content);
	const textViewClass = java.getClass('android.widget.TextView');
	const imageViewClass = java.getClass('android.widget.ImageView');
	const layerDrawableClass = java.getClass('android.graphics.drawable.LayerDrawable');
	const ours = java.createAssociationKey();
	const original = java.createAssociationKey();
	const drawnFor = java.createAssociationKey();
	const scope = ui.createScope();
	const needsBubble = ui.callback((self: NativeJavaValue) => {
		const row = javaReference(self);

		if (!row) return;

		setTimeout(() => {
			if (!disposed) schedule(row);
		}, BIND_SETTLE_MS);
	});

	ui.run(
		installBindGuard,
		scope,
		{
			messageView: AndroidClass.messageView,
			bindName: bindMessage.name,
			bindParameters: bindMessage.parameters,
			messageIdGetter: MESSAGE_ID_GETTER,
			layerId: BUBBLE_LAYER_ID,
			ours,
			original,
			drawnFor,
		},
		needsBubble,
	);
	const tracked: NativeJavaReference[] = [];
	const shiftedIcons: NativeJavaReference[] = [];
	const problems = new Map<string, string>();
	const pending: NativeJavaReference[] = [];
	let scheduled = false;
	let placing = 0;
	let disposed = false;
	let appearanceRevision = 0;
	const placedRows = new Map<string, PlacedRow>();

	function rememberPlaced(id: string, width: number, height: number) {
		placedRows.delete(id);
		placedRows.set(id, { width, height, revision: appearanceRevision });

		if (placedRows.size > MAX_TRACKED) placedRows.delete(placedRows.keys().next().value!);
	}

	function alreadyPlaced(row: NativeJavaReference, id: string): boolean {
		const placed = placedRows.get(id);

		if (
			!placed ||
			placed.revision !== appearanceRevision ||
			!javaReference(java.getAssociatedObject(row, ours)) ||
			javaText(java.getAssociatedObject(row, drawnFor)) !== id
		) {
			return false;
		}

		return (
			number(row, 'getWidth') === placed.width && number(row, 'getHeight') === placed.height
		);
	}

	const number = (view: NativeJavaReference, method: string) =>
		javaNumber(java.invoke(view, method, [])) ?? 0;
	const isInstance = (type: NativeJavaReference, view: NativeJavaReference) =>
		javaFlag(java.invoke(type, 'isInstance', [view]));

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

	const ROW_READS = ['getWidth', 'getHeight', 'getBackground'];

	const ACCESSORIES_READS = ['getLeft', 'getTop', 'getWidth'];

	const columnGutters = new Map<number, number>();
	const awaitingGutter: NativeJavaReference[] = [];

	type RowHeader = { left: number; top: number; bottom: number; shown: boolean };

	type RowMeasure = {
		area: Edges | undefined;
		column: Edges | undefined;
		columnLeft: number | undefined;
		header: RowHeader | undefined;
		width: number;
		height: number;
		background: NativeJavaReference | null;
		iconShifts: NativeJavaBatchOperation[];
	};

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

	function remeasure(row: NativeJavaReference) {
		const id = messageId(row);

		if (id) placedRows.delete(id);

		schedule(row);
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

		if (awaitingGutter.length > MAX_TRACKED) awaitingGutter.shift();
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

	type MeasuredChild = { child: NativeJavaReference; width: number; left: number; right: number };

	async function tightRight(
		measured: MeasuredChild,
		iconShifts: NativeJavaBatchOperation[],
	): Promise<number> {
		if (isInstance(contentClass, measured.child)) {
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

		if (!isInstance(textViewClass, label) || !isInstance(imageViewClass, icon)) return;

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

	async function isNested(row: NativeJavaReference): Promise<boolean> {
		const [outer] = await java.findViews(row, AndroidClass.messageView, {
			direction: 'ancestors',
			maxDepth: MAX_ANCESTORS,
			maxResults: 1,
			stopAtMatch: true,
		});

		return !!javaReference(outer);
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

	function restoreOperations(row: NativeJavaReference): NativeJavaBatchOperation[] {
		const drawn = javaReference(java.getAssociatedObject(row, ours));

		if (!drawn) return [];

		const background = javaReference(java.getAssociatedObject(row, original));

		java.setAssociatedObject(row, ours, { type: 'null' });

		return [
			{
				op: 'invoke',
				handle: row,
				name: 'setBackground',
				args: [background ?? { type: 'null', class: 'android.graphics.drawable.Drawable' }],
			},
		];
	}

	function unshiftOperation(icon: NativeJavaReference): NativeJavaBatchOperation {
		return { op: 'invoke', handle: icon, name: 'setTranslationX', args: [javaFloat(0)] };
	}

	function noteProblem(id: string | undefined, problem: string | undefined) {
		const key = id ?? 'unknown message';

		if (problem) problems.set(key, problem);
		else problems.delete(key);

		if (problems.size > MAX_TRACKED) problems.delete(problems.keys().next().value!);
	}

	function messageId(row: NativeJavaReference): string | undefined {
		try {
			return javaText(java.getField(row, idField));
		} catch {
			return undefined;
		}
	}

	async function isBubble(background: NativeJavaReference): Promise<boolean> {
		if (!isInstance(layerDrawableClass, background)) return false;

		const [layer] = await runOnMain(java, [
			{
				op: 'invoke',
				handle: background,
				name: 'findDrawableByLayerId',
				args: [javaInt(BUBBLE_LAYER_ID)],
			},
		]);

		return !!javaReference(layer);
	}

	let densityValue: Promise<number> | undefined;

	function density(view: NativeJavaReference): Promise<number> {
		densityValue ??= displayDensity(java, view);

		return densityValue;
	}

	async function place(row: NativeJavaReference) {
		const placedId = messageId(row);

		if (placedId && alreadyPlaced(row, placedId)) return;

		const style = currentAppearance();
		const card = style.layout === BubbleLayout.card;
		const [measure, scale] = await Promise.all([measureRow(row, !card), density(row)]);
		const area = card ? measure?.column : measure?.area;

		if (disposed) return;

		if (!measure || !area) {
			if (placedId) placedRows.delete(placedId);

			await runOnMain(java, measure?.iconShifts ?? []);

			return restore(row);
		}

		const box: Box = {
			x: area.left,
			y: area.top,
			width: area.right - area.left,
			height: area.bottom - area.top,
		};
		const inset = card ? CARD_INSET * scale : style.horizontalPadding * scale;
		const frame = card
			? cardFrame(box, inset)
			: bubbleFrame(
					box,
					0,
					{ horizontal: inset, vertical: style.verticalPadding * scale },
					measure.header?.shown ? measure.header.bottom : undefined,
				);
		const insets = rowInsets(frame, measure.width, measure.height);

		noteProblem(
			messageId(row),
			bubbleProblem(
				frame,
				measure.width,
				box.width,
				measure.columnLeft === undefined ? undefined : measure.columnLeft - inset,
			),
		);
		const shape = java.construct('android.graphics.drawable.GradientDrawable', []);

		java.invoke(shape, 'setCornerRadius', [javaFloat(style.radius * scale)]);
		java.invoke(shape, 'setColor', [
			javaInt(argb(isOwnMessage(messageId(row)) ? style.ownColor : style.color)),
		]);

		const bubble = java.construct('android.graphics.drawable.LayerDrawable', [
			{ type: 'array', componentType: 'android.graphics.drawable.Drawable', value: [shape] },
		]);

		java.invoke(bubble, 'setId', [javaInt(0), javaInt(BUBBLE_LAYER_ID)]);
		java.invoke(bubble, 'setLayerInset', [
			javaInt(0),
			javaInt(insets.left),
			javaInt(insets.top),
			javaInt(insets.right),
			javaInt(insets.bottom),
		]);
		java.invoke(bubble, 'setPadding', [javaInt(0), javaInt(0), javaInt(0), javaInt(0)]);
		const current = measure.background;
		const drawn = javaReference(java.getAssociatedObject(row, ours));

		if (!drawn || !current || !sameJavaReference(current, drawn)) {
			const stale = current && (await isBubble(current));

			java.setAssociatedObject(row, original, stale || !current ? { type: 'null' } : current);
		}

		if (disposed) return;

		java.setAssociatedObject(row, ours, bubble);
		const drawnMessage = messageId(row);

		java.setAssociatedObject(row, drawnFor, javaString(drawnMessage ?? ''));
		track(row);
		await runOnMain(java, [
			...measure.iconShifts,
			{ op: 'invoke', handle: row, name: 'setBackground', args: [bubble] },
		]);

		if (drawnMessage) {
			rememberPlaced(drawnMessage, measure.width, measure.height);
			ui.run(rememberBubble, drawnMessage, {
				...insets,
				radius: style.radius * scale,
				color: argb(isOwnMessage(drawnMessage) ? style.ownColor : style.color),
				rowWidth: measure.width,
			});
		}
	}

	let flushing: Promise<void> = Promise.resolve();

	async function placeAll() {
		const queue = pending.splice(0);

		placing++;

		async function worker() {
			for (let row = queue.shift(); row && !disposed; row = queue.shift()) {
				await place(row).catch((error) => {
					if (!isCancellation(error)) {
						console.error(`[${PLUGIN_NAME}] Failed to place a bubble:`, error);
					}
				});
			}
		}

		try {
			await Promise.all(Array.from({ length: PLACEMENT_WORKERS }, worker));
		} finally {
			placing--;
		}
	}

	function flush() {
		scheduled = false;
		flushing = flushing.then(placeAll);

		return flushing;
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

		if (!row || !isInstance(messageClass, row)) return;

		const id = messageId(row);

		if (id && alreadyPlaced(row, id)) return;

		if (!(await isNested(row))) schedule(row);
	}

	const token = hooks.hook(
		AndroidClass.accessories,
		'onLayout',
		LAYOUT_PARAMETERS,
		RECEIVER_ONLY_AFTER_CALL,
		({ self }) => {
			const accessories = javaReference(self);

			if (!accessories) return;

			void scheduleRow(accessories).catch((error) => {
				if (!isCancellation(error)) {
					console.error(`[${PLUGIN_NAME}] Failed to find a bubble's row:`, error);
				}
			});
		},
	);

	async function lostBubbles(): Promise<string[]> {
		const drawn = tracked.filter((row) => javaReference(java.getAssociatedObject(row, ours)));
		const states = await runOnMain(
			java,
			drawn.flatMap((row) => readCalls(row, ['isAttachedToWindow', 'getBackground'])),
		);
		const attached = drawn
			.map((row, index) => ({
				row,
				attached: javaFlag(states[index * 2]),
				background: javaReference(states[index * 2 + 1]),
			}))
			.filter((entry) => entry.attached);
		const layered = attached.filter(
			(entry) => entry.background && isInstance(layerDrawableClass, entry.background),
		);
		const layers = await runOnMain(
			java,
			layered.map((entry) => ({
				op: 'invoke' as const,
				handle: entry.background!,
				name: 'findDrawableByLayerId',
				args: [javaInt(BUBBLE_LAYER_ID)],
			})),
		);
		const bubbled = new Set(
			layered.filter((_, index) => javaReference(layers[index])).map((entry) => entry.row),
		);

		return attached
			.filter((entry) => !bubbled.has(entry.row))
			.map((entry) => `${messageId(entry.row) ?? 'a row'} lost its bubble`);
	}

	async function refreshVisible() {
		const root = currentDecorView(java);

		if (!root) return;

		for (const row of await findViewsOfClass(java, root, AndroidClass.messageView)) {
			if (!(await isNested(row))) schedule(row);
		}
	}

	refreshVisible().catch((error) => {
		if (!isCancellation(error)) {
			console.error(`[${PLUGIN_NAME}] Failed to scan the views on screen:`, error);
		}
	});

	return {
		placed: () => tracked.length,
		settling: () => scheduled || placing > 0 || pending.length > 0,
		problems: async () => [
			...[...problems].map(([id, problem]) => `${id} ${problem}`),
			...(await lostBubbles()),
		],
		refresh() {
			appearanceRevision++;
			ui.run(forgetBubbles);

			if (currentAppearance().layout === BubbleLayout.card && shiftedIcons.length) {
				runOnMain(java, shiftedIcons.splice(0).map(unshiftOperation)).catch((error) => {
					if (!isCancellation(error)) {
						console.error(
							`[${PLUGIN_NAME}] Failed to put the footer icons back:`,
							error,
						);
					}
				});
			}

			for (const row of tracked) schedule(row);

			refreshVisible().catch((error) => {
				if (!isCancellation(error)) {
					console.error(`[${PLUGIN_NAME}] Failed to scan the views on screen:`, error);
				}
			});
		},
		async dispose() {
			disposed = true;
			scope.dispose();
			hooks.remove(token);
			pending.length = 0;
			await flushing;

			try {
				await runOnMain(java, [
					...tracked.splice(0).flatMap(restoreOperations),
					...shiftedIcons.splice(0).map(unshiftOperation),
				]);
			} catch (error) {
				if (!isCancellation(error)) {
					console.error(`[${PLUGIN_NAME}] Failed to restore the rows:`, error);
				}
			}
		},
	};
}

export default { drawAndroidBubbles };
