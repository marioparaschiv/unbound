import type {
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeJavaReference,
	NativeJavaValue,
	NativeUICallback,
	NativeUIScope,
} from '@unbound-app/api/native';
import {
	javaBoolean,
	javaFlag,
	javaInt,
	javaNumber,
	javaReference,
	javaText,
} from '@unbound-plugins/shared/native/android/java-values';

import type { RowPaint } from '~/native/android/row-paint';
import {
	blurShader,
	forgetBlurs,
	installBlurScroll,
	prepareBlur,
	trackBlur,
} from '~/native/android/ui-blur';
import { bubbleDrawable } from '~/native/android/ui-drawable';
import {
	moveHeading,
	padRow,
	paintBackground,
	placeAvatar,
	roundMosaic,
	viewIn,
	readTaps,
	resetAvatar,
	restoreRow,
	rowKind,
	type AuthorTaps,
	type MessageInfo,
	type RowConfig,
	type RowKind,
} from '~/native/android/ui-row';

const STATE_KEY = '__unboundChatBubblesAndroid';
const MAX_CACHED = 400;
const WIDTH_TOLERANCE = 1;
const HEIGHT_TOLERANCE = 1;
const MOSAIC_DEPTH = 4;
/** `ViewGroup.onLayout`'s parameters. */
const LAYOUT_PARAMETERS = ['boolean', 'int', 'int', 'int', 'int'];
/** `View.MeasureSpec`: the size bits, and the mode that fixes the size. */
const MEASURE_SIZE = 0x3fffffff;
const MEASURE_EXACTLY = 0x40000000;

/** The method that paints Discord's mention and highlight tint behind a row, and the fields it reads the colors from. */
export type HighlightPainter = {
	className: string;
	method: string;
	background: string;
	bar: string;
};

export type BindHook = {
	messageView: string;
	bindName: string;
	bindParameters: string[];
	/** The row's accessories list, whose layout pass runs once the row's content has its final size. */
	accessories: string;
};

/** A message's bubble, its blur's shader, and which blurred background that came from, -1 for none. */
type CachedDrawable = {
	drawable: NativeJavaReference;
	shader: NativeJavaReference | undefined;
	generation: number;
};

type BubbleState = {
	java: NativeJavaBridge;
	config: RowConfig;
	/** The message row's class. */
	messageView: string;
	paints: Map<string, RowPaint>;
	drawables: Map<string, CachedDrawable>;
	/** The row each message was last bound to. */
	rows: Map<string, NativeJavaReference>;
	/** The rows showing a message without a paint that fits them, by handle. */
	waiting: Set<string>;
	/** Every row this side changed, to restore when the plugin stops. */
	touched: Map<string, NativeJavaReference>;
	infos: Map<string, MessageInfo>;
	/** The picture each author's latest group starts with. */
	pictures: Map<string, MessageInfo>;
	taps: Map<string, AuthorTaps>;
	/** The channel the rows were last bound in. */
	channel: string | undefined;
	bars: Map<string, number>;
	list: NativeJavaReference | null;
};

type StateHolder = Record<typeof STATE_KEY, BubbleState | undefined>;

function holder(): StateHolder {
	'worklet';

	return globalThis as unknown as StateHolder;
}

function remember<T>(map: Map<string, T>, key: string, value: T) {
	'worklet';
	map.delete(key);
	map.set(key, value);

	if (map.size > MAX_CACHED) map.delete(map.keys().next().value as string);
}

function keyOf(view: NativeJavaReference): string {
	'worklet';

	return 'value' in view ? String(view.value) : '';
}

function textField(java: NativeJavaBridge, from: NativeJavaReference, name: string) {
	'worklet';

	try {
		return javaText(java.getField(from, name));
	} catch {
		// A build without the field shows no such value.
		return undefined;
	}
}

// Ids come wrapped, such as `UserId(id=263689920210534400)`, whose text keeps every digit, or as longs, which a JS number rounds but still tells apart.
function idField(java: NativeJavaBridge, from: NativeJavaReference, name: string) {
	'worklet';

	try {
		const value = java.getField(from, name);
		const wrapped = javaReference(value);
		const text = wrapped
			? javaText(java.invoke(wrapped, 'toString', []))
			: String(javaNumber(value) ?? '');

		return text?.match(/\d+/)?.[0];
	} catch {
		// A build without the field shows no such value.
		return undefined;
	}
}

// Rows draw their bubbles past their own bounds, into the room of the rows around them.
function unclipList(current: BubbleState, row: NativeJavaReference) {
	'worklet';

	const { java } = current;
	const list = javaReference(java.invoke(row, 'getParent', []));

	// Each chat screen has its own list.
	if (!list || (current.list && javaFlag(java.invoke(current.list, 'equals', [list])))) return;

	current.list = list;
	java.invoke(list, 'setClipChildren', [javaBoolean(false)]);
}

/**
 * @description Lays the chat list out again after rows changed size outside its layout pass. React Native drops the list's own layout requests, so a row padded from the JS thread keeps its old height until the list is measured and laid out by hand.
 */
export function relayoutList() {
	'worklet';
	const current = holder()[STATE_KEY];
	const list = current?.list;

	if (!current || !list) return;

	const { java } = current;

	try {
		if (!javaFlag(java.invoke(list, 'isLayoutRequested', []))) return;

		const [left, top, right, bottom] = ['getLeft', 'getTop', 'getRight', 'getBottom'].map(
			(name) => javaNumber(java.invoke(list, name, [])) ?? 0,
		) as [number, number, number, number];
		const exactly = (size: number) => javaInt((size & MEASURE_SIZE) | MEASURE_EXACTLY);

		java.invoke(list, 'measure', [exactly(right - left), exactly(bottom - top)]);
		java.invoke(list, 'layout', [javaInt(left), javaInt(top), javaInt(right), javaInt(bottom)]);
	} catch (error) {
		console.error(`[Chat Bubbles] ${String(error)}`);
	}
}

// A bubble that blurs is drawn again once the chat background behind it is blurred anew, or first found.
function drawableFor(current: BubbleState, id: string, paint: RowPaint, height: number) {
	'worklet';
	const { java, list } = current;
	const generation = paint.blur && list ? (prepareBlur(java, list, paint.blur) ?? -1) : -1;
	const cached = current.drawables.get(id);

	if (cached?.generation === generation) return cached;

	const shader = generation === -1 ? undefined : blurShader(java);
	const drawable = bubbleDrawable(
		java,
		{ ...paint, width: paint.rowWidth, height, ...(shader ? { backdrop: shader } : {}) },
		current.config.layerId,
	);

	if (!drawable) return null;

	const made = { drawable, shader, generation };

	remember(current.drawables, id, made);

	return made;
}

function paintRow(current: BubbleState, row: NativeJavaReference, id: string, kind: RowKind) {
	'worklet';
	const { java, config } = current;
	const paint = current.paints.get(id);
	const width = javaNumber(java.invoke(row, 'getWidth', []));
	// A row Discord just made has no width until its first layout, which gives it the list's.
	const fits =
		paint &&
		width !== undefined &&
		(width === 0 || Math.abs(width - paint.rowWidth) <= WIDTH_TOLERANCE);

	remember(current.touched, keyOf(row), row);

	if (paint && fits) current.waiting.delete(keyOf(row));
	else current.waiting.add(keyOf(row));

	padRow(java, config, row, kind);
	resetAvatar(java, config, row, kind);

	const mosaic = viewIn(java, row, config.ids.mosaic);

	if (mosaic) roundMosaic(java, config, mosaic, fits ? paint?.mediaRadius : undefined);

	if (!paint || !fits) {
		paintBackground(java, config, row, null);
		trackBlur(java, row, null, undefined);

		const fallback = config.fallback;
		const none = { x: 0, y: 0 };
		const starts = kind !== 'next';

		moveHeading(java, config, row, {
			name: starts && fallback ? fallback.name : none,
			avatar: starts && fallback ? fallback.avatar : none,
			reply: starts && fallback ? fallback.reply : none,
		});

		if (starts && fallback?.hideStart) {
			placeAvatar(
				java,
				config,
				row,
				{ start: true, end: false, author: '', bottom: 0, top: 0, height: 0 },
				undefined,
				undefined,
			);
		}

		return false;
	}

	const drawn = drawableFor(current, id, paint, paint.rowHeight);

	paintBackground(java, config, row, drawn?.drawable ?? null);
	trackBlur(java, row, viewIn(java, row, config.layerId), drawn?.shader);
	moveHeading(java, config, row, paint);

	if (paint.picture) {
		placeAvatar(
			java,
			config,
			row,
			paint.picture,
			current.infos.get(id)?.avatar
				? current.infos.get(id)
				: (current.pictures.get(paint.picture.author) ?? {
						avatar: paint.picture.url,
						decoration: paint.picture.decoration,
					}),
			current.taps.get(paint.picture.author),
		);
	}

	return true;
}

function noteMessage(
	current: BubbleState,
	row: NativeJavaReference,
	id: string,
	message: NativeJavaValue | undefined,
	kind: RowKind,
) {
	'worklet';
	const { java } = current;
	const bridge = javaReference(message);

	if (!bridge) return;

	const key = idField(java, bridge, 'authorId');
	const channel = idField(java, bridge, 'channelId');

	// A member's picture can differ between servers, so a new channel starts without any.
	if (channel && channel !== current.channel) {
		current.channel = channel;
		current.pictures.clear();
		current.taps.clear();
	}

	const info = {
		avatar: textField(java, bridge, 'avatarURL'),
		decoration: textField(java, bridge, 'avatarDecorationURL'),
		author: key,
	};

	remember(current.infos, id, info);

	if (kind === 'next' || !key) return;

	// A group's first row always carries the author's picture, for later rows that may not.
	if (info.avatar) remember(current.pictures, key, info);

	const taps = readTaps(java, current.config, row);

	if (taps) remember(current.taps, key, taps);
}

/**
 * @description Lays out and paints each row right after Discord binds it, from a hook on the UI thread: a measured message gets its bubble, moves and avatar at once, and any other row gets its room and Discord's own look until it is measured.
 * @param scope The plugin's UI scope.
 * @param bind The message view class and its bind method.
 * @param config The row views, room, inset and fallback layout.
 * @param needsBubble Wakes the JS thread for a row whose message has no paint yet.
 */
export function installRowHooks(
	scope: NativeUIScope,
	bind: BindHook,
	config: RowConfig,
	needsBubble: NativeUICallback<[NativeJavaValue]>,
) {
	'worklet';
	const java = scope.java as NativeJavaBridge;
	const hooks = scope.hooks as NativeJavaHooksBridge;
	const current: BubbleState = {
		java,
		config,
		messageView: bind.messageView,
		paints: new Map(),
		drawables: new Map(),
		rows: new Map(),
		waiting: new Set(),
		touched: new Map(),
		infos: new Map(),
		pictures: new Map(),
		taps: new Map(),
		channel: undefined,
		bars: new Map(),
		list: null,
	};

	holder()[STATE_KEY] = current;

	installBlurScroll(hooks, java);
	hooks.hook(
		bind.messageView,
		bind.bindName,
		bind.bindParameters,
		{ notify: 'after' },
		(event: { self?: NativeJavaValue; args?: NativeJavaValue[] }) => {
			const row = javaReference(event.self);

			if (!row) return;

			try {
				const id = javaText(java.getField(row, current.config.idField));

				if (!id) return;

				const kind = rowKind(java, current.config, row);

				unclipList(current, row);
				noteMessage(current, row, id, event.args?.[0], kind);
				remember(current.rows, id, row);

				if (!paintRow(current, row, id, kind) && event.self) needsBubble(event.self);
			} catch (error) {
				console.error(`[Chat Bubbles] ${String(error)}`);
			}
		},
	);

	// A row bound ahead of the scroll is laid out only once it shows, and media or reactions change a row's height later, so each layout of a row's content checks its paint still fits.
	hooks.hook(
		bind.accessories,
		'onLayout',
		LAYOUT_PARAMETERS,
		{ notify: 'after' },
		(event: { self?: NativeJavaValue }) => {
			const accessories = javaReference(event.self);

			if (!accessories || holder()[STATE_KEY] !== current) return;

			try {
				const row = javaReference(java.invoke(accessories, 'getParent', []));
				const id = row ? javaText(java.getField(row, current.config.idField)) : undefined;

				if (!row || !id) return;

				const paint = current.paints.get(id);
				const height = javaNumber(java.invoke(row, 'getHeight', [])) ?? 0;

				if (
					current.waiting.has(keyOf(row)) ||
					!paint ||
					Math.abs(height - paint.rowHeight) > HEIGHT_TOLERANCE
				) {
					needsBubble(row as unknown as NativeJavaValue);
				}
			} catch (error) {
				console.error(`[Chat Bubbles] ${String(error)}`);
			}
		},
	);
}

/**
 * @description Rounds a media mosaic as its message's bubble asks, from the mosaic's own layout pass, which runs after its row is bound.
 * @param mosaic The mosaic's list view.
 */
export function roundMosaicOf(mosaic: NativeJavaReference) {
	'worklet';
	const current = holder()[STATE_KEY];

	if (!current) return;

	const { java, config } = current;
	let row: NativeJavaReference | null = mosaic;

	// The mosaic sits in a media item, in the row's accessories list, in the row.
	for (let depth = 0; row && depth < MOSAIC_DEPTH; depth++) {
		row = javaReference(java.invoke(row, 'getParent', []));

		if (row && javaText(java.className(row)) === current.messageView) break;
	}

	if (!row || javaText(java.className(row)) !== current.messageView) return;

	const id = javaText(java.getField(row, config.idField));
	const paint = id ? current.paints.get(id) : undefined;

	roundMosaic(java, config, mosaic, paint?.mediaRadius);
}

/**
 * @description Stops Discord painting its mention and highlight tint behind rows with a bubble, which shows the mention itself, and tells the JS thread the tint's bar color.
 * @param scope The plugin's UI scope.
 * @param painter The tint's painter method and color fields.
 * @param onBar Called with a message id and its bar color the first time it shows, or when it changes.
 */
export function installHighlightHook(
	scope: NativeUIScope,
	painter: HighlightPainter,
	onBar: NativeUICallback<[string, number]>,
) {
	'worklet';
	const java = scope.java as NativeJavaBridge;
	const hooks = scope.hooks as NativeJavaHooksBridge;

	hooks.hook(
		painter.className,
		painter.method,
		['android.graphics.Canvas', 'android.view.View'],
		{ notify: true },
		(event: { self?: NativeJavaValue; args?: NativeJavaValue[] }) => {
			const current = holder()[STATE_KEY];
			const self = javaReference(event.self);
			const row = javaReference(event.args?.[1]);

			if (!current || !self || !row) return;

			try {
				const id = javaText(java.getField(row, current.config.idField));

				if (!id || !current.paints.has(id)) return;

				const boxed = javaReference(java.getField(self, painter.bar));
				const bar = boxed ? javaNumber(java.invoke(boxed, 'intValue', [])) : undefined;

				java.setField(self, painter.background, { type: 'null' });
				java.setField(self, painter.bar, { type: 'null' });

				if (bar !== undefined && current.bars.get(id) !== bar) {
					remember(current.bars, id, bar);
					onBar(id, bar);
				}
			} catch (error) {
				console.error(`[Chat Bubbles] ${String(error)}`);
			}
		},
	);
}

/**
 * @description Remembers a message's measured paint and paints the row showing it, if it still does.
 * @param id The message.
 * @param paint Its bubble, moves and avatar, in pixels.
 * @param measured The handle of the row it was measured in, for a row bound before the hooks were installed.
 */
export function paintMessage(id: string, paint: RowPaint, measured: string | null) {
	'worklet';
	const current = holder()[STATE_KEY];

	if (!current) return;

	remember(current.paints, id, paint);
	current.drawables.delete(id);

	const row = measured
		? ({ type: 'handle', value: measured } as NativeJavaReference)
		: current.rows.get(id);

	if (!row) return;

	try {
		if (javaText(current.java.getField(row, current.config.idField)) !== id) return;

		unclipList(current, row);
		remember(current.rows, id, row);
		paintRow(current, row, id, rowKind(current.java, current.config, row));
	} catch (error) {
		console.error(`[Chat Bubbles] ${String(error)}`);
	}
}

/**
 * @description Changes the room, inset and fallback layout, forgets every paint, and lays out the rows on screen again.
 * @param config The new room, inset and fallback.
 */
export function setRowConfig(config: Pick<RowConfig, 'rooms' | 'inset' | 'fallback'>) {
	'worklet';
	const current = holder()[STATE_KEY];

	if (!current) return;

	current.config = { ...current.config, ...config };
	current.paints.clear();
	current.drawables.clear();
	forgetBlurs();

	for (const [id, row] of current.rows) {
		try {
			if (javaText(current.java.getField(row, current.config.idField)) === id) {
				paintRow(current, row, id, rowKind(current.java, current.config, row));
			}
		} catch (error) {
			console.error(`[Chat Bubbles] ${String(error)}`);
		}
	}
}

/**
 * @description Puts every row this side changed back the way Discord laid it out, and forgets everything.
 */
export function restoreRows() {
	'worklet';
	const current = holder()[STATE_KEY];

	if (!current) return;

	for (const row of current.touched.values()) {
		try {
			restoreRow(current.java, current.config, row);
		} catch (error) {
			console.error(`[Chat Bubbles] ${String(error)}`);
		}
	}

	if (current.list) {
		current.java.invoke(current.list, 'setClipChildren', [javaBoolean(true)]);
		relayoutList();
	}

	forgetBlurs();

	holder()[STATE_KEY] = undefined;
}

export default {
	installRowHooks,
	installHighlightHook,
	roundMosaicOf,
	paintMessage,
	setRowConfig,
	restoreRows,
	relayoutList,
};
