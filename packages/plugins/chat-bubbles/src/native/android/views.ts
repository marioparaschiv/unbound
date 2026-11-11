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
	findViewsOfClass,
	readCalls,
	runOnMain,
} from '@unbound-plugins/shared/native/android/views';
import {
	javaFlag,
	javaFloat,
	javaInt,
	javaReference,
	javaString,
	javaText,
	sameJavaReference,
} from '@unbound-plugins/shared/native/android/java-values';
import {
	MESSAGE_VIEW,
	messageBindMethod,
	messageIdField,
	messageIdOf,
} from '@unbound-plugins/shared/native/android/discord-views';

import { bubbleFrame, bubbleProblem, cardFrame, rowInsets, type Box } from '~/lib/geometry';
import { AndroidClass, BubbleLayout, CARD_INSET } from '~/lib/constants';
import { forgetBubbles, installBindGuard, rememberBubble } from '~/native/android/worklets';
import { createRowMeasure, isInstanceOf, readNumber } from '~/native/android/row-measure';
import { currentAppearance } from '~/lib/theme';
import { argb } from '~/lib/style';
import { isOwnMessage } from '~/lib/author';
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
const BUBBLE_LAYER_ID = 0x0b0b1e;
const BIND_SETTLE_MS = 50;
const PLACEMENT_WORKERS = 8;
const LAYOUT_PARAMETERS = ['boolean', 'int', 'int', 'int', 'int'];

/**
 * @description Draws a rounded bubble behind each Android message as the row's background, sized to its content or, in the card layout, covering its whole content column, without changing the row's padding.
 * @param native The plugin's Java and hook bridges.
 * @returns `refresh`, which repaints the bubbles it drew, and `dispose`, which brings back the rows' own backgrounds.
 */
export function drawAndroidBubbles({ java, hooks, ui }: AndroidNative) {
	const messageClass = java.getClass(MESSAGE_VIEW);
	const bindMessage = messageBindMethod(java);
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
			messageView: MESSAGE_VIEW,
			bindName: bindMessage.name,
			bindParameters: bindMessage.parameters,
			idField: messageIdField(java),
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
	const { measureRow, density } = createRowMeasure(java, { shiftedIcons, remeasure });

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
			readNumber(java, row, 'getWidth') === placed.width &&
			readNumber(java, row, 'getHeight') === placed.height
		);
	}

	const isInstance = (type: NativeJavaReference, view: NativeJavaReference) =>
		isInstanceOf(java, type, view);

	function remeasure(row: NativeJavaReference) {
		const id = messageId(row);

		if (id) placedRows.delete(id);

		schedule(row);
	}

	async function isNested(row: NativeJavaReference): Promise<boolean> {
		const [outer] = await java.findViews(row, MESSAGE_VIEW, {
			direction: 'ancestors',
			maxDepth: MAX_ANCESTORS,
			maxResults: 1,
			stopAtMatch: true,
		});

		return !!javaReference(outer);
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

	const messageId = (row: NativeJavaReference) => messageIdOf(java, row);

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
						logger.error(`Failed to place a bubble:`, error);
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
					logger.error(`Failed to find a bubble's row:`, error);
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

		for (const row of await findViewsOfClass(java, root, MESSAGE_VIEW)) {
			if (!(await isNested(row))) schedule(row);
		}
	}

	refreshVisible().catch((error) => {
		if (!isCancellation(error)) {
			logger.error(`Failed to scan the views on screen:`, error);
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
						logger.error(`Failed to put the footer icons back:`, error);
					}
				});
			}

			for (const row of tracked) schedule(row);

			refreshVisible().catch((error) => {
				if (!isCancellation(error)) {
					logger.error(`Failed to scan the views on screen:`, error);
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
					logger.error(`Failed to restore the rows:`, error);
				}
			}
		},
	};
}

export default { drawAndroidBubbles };
