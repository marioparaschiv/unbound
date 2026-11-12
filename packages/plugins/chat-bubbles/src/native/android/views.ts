import { isCancellation } from '@unbound-plugins/shared/native/cancellation';
import type {
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeJavaReference,
	NativeJavaValue,
	NativeUIBridge,
} from '@unbound-app/api/native';
import {
	currentDecorView,
	findViewsOfClass,
	runOnMain,
} from '@unbound-plugins/shared/native/android/views';
import {
	javaInt,
	javaNumber,
	javaReference,
} from '@unbound-plugins/shared/native/android/java-values';
import {
	MESSAGE_VIEW,
	messageBindMethod,
	messageIdField,
} from '@unbound-plugins/shared/native/android/discord-views';

import type { RowConfig } from '~/native/android/ui-row';
import {
	installHighlightHook,
	installRowHooks,
	paintMessage,
	relayoutList,
	restoreRows,
	setRowConfig,
} from '~/native/android/worklets';
import { installMosaicHook, mosaicShape, restoreMosaics } from '~/native/android/ui-media';
import { readRow } from '~/native/android/ui-measure';
import { rowViewIds } from '~/native/android/ids';
import { authorPicture } from '~/native/android/author-picture';
import { createMeasure } from '~/native/android/measure';
import { createNeighbours } from '~/native/android/neighbours';
import { createStoreGroups } from '~/native/android/store-groups';
import { rowFrame, rowPaint } from '~/native/android/row-paint';
import { colorFromArgb, findHighlightPainter } from '~/native/android/highlight';
import { cellFallback } from '~/lib/cell-paint';
import { bubbleProblem } from '~/lib/geometry';
import { createRowGroups } from '~/lib/row-groups';
import {
	accessoryGap,
	parseHexColor,
	rowInset,
	rowRooms,
	type BubbleAppearance,
} from '~/lib/style';
import { currentAppearance } from '~/lib/theme';
import { messageAuthor, isOwnMessage } from '~/lib/author';
import { MessageStore, SelectedChannelStore } from '~/lib/modules';
import { AndroidClass, BubbleStyle, ReplyIcon } from '~/lib/constants';

type AndroidNative = {
	java: NativeJavaBridge;
	hooks: NativeJavaHooksBridge;
	ui: NativeUIBridge;
};

const BUBBLE_LAYER_ID = 0x0b0b1e;
const REPLY_ICON_ID = 0x0b0b1f;
const PLACEMENT_WORKERS = 4;
const MAX_TRACKED = 256;
const MENTION_BAR = { ...parseHexColor(BubbleStyle.mentionColor)!, alpha: 1 };

function bounded<T>(map: Map<string, T>, key: string, value: T) {
	map.delete(key);
	map.set(key, value);

	if (map.size > MAX_TRACKED) map.delete(map.keys().next().value!);
}

function report(action: string) {
	return (error: unknown) => {
		if (!isCancellation(error)) logger.error(`Failed to ${action}:`, error);
	};
}

/**
 * @description Draws a bubble behind each Android message as its row's background, grouped, tailed and highlighted like iOS, and moves Discord's own name, time, reply and avatar views around it.
 * @param native The plugin's Java, hook and UI bridges.
 * @returns `refresh`, which repaints every bubble, and `dispose`, which puts every row back.
 */
export function drawAndroidBubbles({ java, ui }: AndroidNative) {
	const found = rowViewIds(java);

	if (!found) throw new Error('Failed to find the message row views: no activity is showing.');

	const { ids, replyIcon, scale } = found;
	const bind = messageBindMethod(java);
	const idField = messageIdField(java);
	const scope = ui.createScope();
	const keys = {
		padding: java.createAssociationKey(),
		avatar: java.createAssociationKey(),
		media: java.createAssociationKey(),
		mediaRadius: java.createAssociationKey(),
	};
	const measure = createMeasure(
		java,
		(row) =>
			'value' in row
				? ui.call(readRow, scope, row.value, ids, idField)
				: Promise.resolve(null),
		keys.media,
	);
	const neighbours = createNeighbours(currentAppearance, (id) => redraw([id]));
	const groups = createRowGroups(redraw);
	const stored = createStoreGroups((id) => redraw([id]));
	const rows = new Map<string, NativeJavaReference>();
	const pushed = new Map<string, string>();
	const sizes = new Map<string, string>();
	const bars = new Map<string, number>();
	const problems = new Map<string, string>();
	const reactions = new Map<string, NativeJavaReference>();
	const pending = new Map<string, { row: NativeJavaReference; force: boolean }>();
	const unpainted = new Set<string>();
	const workers = new Set<Promise<void>>();
	let disposed = false;
	let painterSearched = false;

	function rowConfig(style: BubbleAppearance): Pick<RowConfig, 'rooms' | 'inset' | 'fallback'> {
		const rooms = rowRooms(style);
		const px = ({ top, bottom }: { top: number; bottom: number }) => ({
			top: top * scale,
			bottom: bottom * scale,
		});
		const fallback = cellFallback(style);
		const move = ({ x, y }: { x: number; y: number }) => ({ x: x * scale, y: y * scale });

		return {
			rooms: { first: px(rooms.first), next: px(rooms.next), reply: px(rooms.reply) },
			inset: rowInset(style) * scale,
			fallback: {
				name: move(fallback.name),
				avatar: move(fallback.avatar),
				reply: move(fallback.reply),
				hideStart: fallback.hideStart,
			},
		};
	}

	ui.run(
		installRowHooks,
		scope,
		{
			messageView: MESSAGE_VIEW,
			bindName: bind.name,
			bindParameters: bind.parameters,
			accessories: AndroidClass.accessories,
		},
		{
			ids,
			idField,
			layerId: BUBBLE_LAYER_ID,
			replyIcon: {
				drawable: replyIcon,
				id: REPLY_ICON_ID,
				size: Math.round(ReplyIcon.size * scale),
				gap: Math.round(ReplyIcon.gap * scale),
			},
			keys,
			...rowConfig(currentAppearance()),
		},
		ui.callback((self: NativeJavaValue) => {
			const row = javaReference(self);

			if (!row || !('value' in row)) return;

			// The row has no paint it can use, so its next one is sent even when unchanged.
			unpainted.add(row.value);
			schedule(row, true);
		}),
	);

	const mosaic = mosaicShape(java);

	if (mosaic) ui.run(installMosaicHook, scope, mosaic);
	else logger.warn('Found no media mosaic layout; wide media keeps Discord’s width.');

	const onBar = ui.callback((id: string, bar: number) => {
		bounded(bars, id, bar);
		redraw([id]);
	});

	async function findPainter(row: NativeJavaReference) {
		if (painterSearched) return;

		painterSearched = true;

		const painter = await findHighlightPainter(java, row);

		if (painter && !disposed) ui.run(installHighlightHook, scope, painter, onBar);
		else if (!painter)
			logger.warn('Found no mention highlight painter; mentions keep Discord’s tint.');
	}

	function redraw(changed: string[]) {
		for (const id of changed) {
			const row = rows.get(id);

			if (row) schedule(row, true);
		}
	}

	function mentionOf(id: string, channelId: string | undefined) {
		const bar = bars.get(id);

		if (bar !== undefined) return colorFromArgb(bar);

		const message = channelId ? MessageStore.getMessage?.(channelId, id) : undefined;

		return (message as { mentioned?: boolean } | undefined)?.mentioned
			? MENTION_BAR
			: undefined;
	}

	async function moveReactions(id: string, view: NativeJavaReference | undefined, gap: number) {
		if (!view) return;

		const params = javaReference(java.invoke(view, 'getLayoutParams', []));
		const top = Math.round(gap * scale);

		if (!params || javaNumber(java.getField(params, 'topMargin')) === top) return;

		bounded(reactions, id, view);
		await runOnMain(java, [
			{ op: 'setField', handle: params, name: 'topMargin', value: javaInt(top) },
			{ op: 'invoke', handle: view, name: 'setLayoutParams', args: [params] },
		]);
	}

	async function place(row: NativeJavaReference, force: boolean) {
		const style = currentAppearance();
		const measured = await measure(row, scale, rowInset(style));

		if (!measured || disposed) return;

		void findPainter(row).catch(report('find the mention highlight painter'));

		const { id, layout } = measured;
		const size = `${layout.width}x${layout.height}`;

		bounded(rows, id, row);

		const repaint = 'value' in row && unpainted.has(row.value);

		if (!force && !repaint && sizes.get(id) === size && pushed.has(id)) return;

		bounded(sizes, id, size);

		const channelId = SelectedChannelStore.getChannelId?.() as string | undefined;
		// The channel's data knows the messages off screen too, so it decides where a group ends; the rows on screen are the fallback.
		const place = groups.place(channelId, id) ?? stored.place(channelId, id, layout.start);
		const edges = { start: place.start, end: place.end };
		const frame = rowFrame(layout, style);
		// Reactions sit between a bubble and the next one of its group, so the bubble stretches only down to them.
		const reach = measured.reactionsTop ?? layout.height;
		const fitted = neighbours.fit(id, frame.frame, reach, place);
		const author = messageAuthor(id, channelId);
		const mention = mentionOf(id, channelId);
		const paint = rowPaint({
			layout,
			measured: frame,
			fitted,
			place: edges,
			style,
			color: isOwnMessage(id, channelId) ? style.ownColor : style.color,
			...(mention ? { mention } : {}),
			...(author ? { author } : {}),
			...(measured.avatar ? { avatarBox: measured.avatar } : {}),
			scale,
		});
		// A group's last row shows the author's picture, which only its first row's bind carries.
		if (paint.picture?.end && !paint.picture.start) {
			Object.assign(paint.picture, authorPicture(paint.picture.author, channelId));
		}

		const problem = bubbleProblem(fitted.frame, layout.width, layout.body.width);

		if (problem) bounded(problems, id, problem);
		else problems.delete(id);

		await moveReactions(id, measured.reactions, accessoryGap(style));

		const signature = JSON.stringify(paint);

		if ('value' in row) unpainted.delete(row.value);

		if (disposed || (!repaint && pushed.get(id) === signature)) return;

		bounded(pushed, id, signature);
		ui.run(paintMessage, id, paint, 'value' in row ? row.value : null);
	}

	// Rows without a usable paint go first: while the list scrolls they show no bubble, while the rest only check theirs.
	function takeNext() {
		let next: [string, { row: NativeJavaReference; force: boolean }] | undefined;

		for (const entry of pending) {
			if (unpainted.has(entry[0])) {
				next = entry;
				break;
			}

			next ??= entry;
		}

		if (next) pending.delete(next[0]);

		return next?.[1];
	}

	async function work() {
		for (let next = takeNext(); next && !disposed; next = takeNext()) {
			await place(next.row, next.force).catch(report('place a bubble'));
		}
	}

	// Each worker drains the queue and ends; a row queued while all of them are busy waits only for the next free one.
	function startWorker() {
		const worker = work().finally(() => {
			workers.delete(worker);

			// Rows painted from here changed size outside the list's layout pass.
			if (!workers.size && !disposed) ui.run(relayoutList);
		});

		workers.add(worker);
	}

	function schedule(row: NativeJavaReference, force = false) {
		if (disposed || !('value' in row)) return;

		const queued = pending.get(row.value);

		pending.set(row.value, { row, force: force || Boolean(queued?.force) });

		if (workers.size < PLACEMENT_WORKERS) startWorker();
	}

	async function refreshVisible() {
		const root = currentDecorView(java);

		if (!root) return;

		for (const row of await findViewsOfClass(java, root, MESSAGE_VIEW)) schedule(row, true);
	}

	refreshVisible().catch(report('scan the rows on screen'));

	return {
		placed: () => pushed.size,
		settling: () => workers.size > 0 || pending.size > 0,
		problems: async () => [...problems].map(([id, problem]) => `${id} ${problem}`),
		refresh() {
			ui.run(setRowConfig, rowConfig(currentAppearance()));
			ui.run(relayoutList);
			neighbours.clear();
			pushed.clear();
			sizes.clear();
			refreshVisible().catch(report('scan the rows on screen'));
		},
		async dispose() {
			disposed = true;
			pending.clear();
			await Promise.all(workers);
			await ui.call(restoreRows).catch(report('restore the rows'));
			await ui.call(restoreMosaics).catch(report('restore the media mosaics'));
			await runOnMain(
				java,
				[...reactions.values()].flatMap((view) => {
					const params = javaReference(java.invoke(view, 'getLayoutParams', []));

					return params
						? [
								{
									op: 'setField' as const,
									handle: params,
									name: 'topMargin',
									value: javaInt(0),
								},
								{
									op: 'invoke' as const,
									handle: view,
									name: 'setLayoutParams',
									args: [params],
								},
							]
						: [];
				}),
			).catch(report('put the reactions back'));
			scope.dispose();
		},
	};
}

export default { drawAndroidBubbles };
