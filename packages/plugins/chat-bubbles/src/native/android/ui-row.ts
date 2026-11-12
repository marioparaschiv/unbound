import type {
	NativeJavaAssociationKey,
	NativeJavaBridge,
	NativeJavaReference,
} from '@unbound-app/api/native';
import {
	javaBoolean,
	javaFloat,
	javaInt,
	javaNumber,
	javaReference,
	javaString,
	javaText,
} from '@unbound-plugins/shared/native/android/java-values';

import type { RowViewIds } from '~/native/android/ids';
import type { RowPaint } from '~/native/android/row-paint';
import { paintReplySpine, type ReplyIconConfig } from '~/native/android/ui-reply-icon';

const VISIBLE = 0;
const INVISIBLE = 4;
const GONE = 8;
const NO_ACCESSIBILITY = 2;
/** `RelativeLayout.ALIGN_BOTTOM`. */
const ALIGN_BOTTOM = 8;
/** The view tags Discord keeps an avatar's tap and long press listeners under. */
const CLICK_TAG = 0xfffe4e67 | 0;
const LONG_CLICK_TAG = 0xfffe4e66 | 0;

type Move = { x: number; y: number };

export type RowRoom = { top: number; bottom: number };

/** Everything the UI thread needs to lay out and paint rows, in pixels. */
export type RowConfig = {
	ids: RowViewIds;
	idField: string;
	layerId: number;
	/** The reply icon shown in place of a reply's spine. */
	replyIcon: ReplyIconConfig;
	keys: {
		padding: NativeJavaAssociationKey;
		avatar: NativeJavaAssociationKey;
		/** A media mosaic's own outline, and the radius this side last rounded it to. */
		media: NativeJavaAssociationKey;
		mediaRadius: NativeJavaAssociationKey;
	};
	rooms: { first: RowRoom; next: RowRoom; reply: RowRoom };
	/** How far the content sits in from each side. */
	inset: number;
	/** How a row is laid out before its message is measured, `null` to leave it to Discord. */
	fallback: { name: Move; avatar: Move; reply: Move; hideStart: boolean } | null;
};

/** What the UI thread remembers about a message's author: the avatar's pictures and taps. */
export type AuthorTaps = {
	click: NativeJavaReference | null;
	long: NativeJavaReference | null;
	touch: string | undefined;
};

export type MessageInfo = { avatar?: string; decoration?: string; author?: string };

export type RowKind = 'first' | 'next' | 'reply';

export function viewIn(java: NativeJavaBridge, row: NativeJavaReference, id: number) {
	'worklet';

	return id ? javaReference(java.invoke(row, 'findViewById', [javaInt(id)])) : null;
}

function shown(java: NativeJavaBridge, view: NativeJavaReference | null): boolean {
	'worklet';

	return Boolean(view) && javaNumber(java.invoke(view!, 'getVisibility', [])) === VISIBLE;
}

/**
 * @description Tells a row's kind from the views Discord's bind just showed or hid.
 * @returns `first` for a row with the author's name, `reply` when it also shows a reply, otherwise `next`.
 */
export function rowKind(
	java: NativeJavaBridge,
	config: RowConfig,
	row: NativeJavaReference,
): RowKind {
	'worklet';
	const { ids } = config;

	if (!shown(java, viewIn(java, row, ids.author_name))) return 'next';

	return shown(java, viewIn(java, row, ids.reply_preview_view)) &&
		shown(java, viewIn(java, row, ids.reply_text))
		? 'reply'
		: 'first';
}

function move(java: NativeJavaBridge, view: NativeJavaReference | null, { x, y }: Move) {
	'worklet';

	if (!view) return;

	java.invoke(view, 'setTranslationX', [javaFloat(x)]);
	java.invoke(view, 'setTranslationY', [javaFloat(y)]);
}

/**
 * @description Grows a row by its room above and below, and lays its content in from both sides, keeping Discord's own padding to restore.
 */
export function padRow(
	java: NativeJavaBridge,
	config: RowConfig,
	row: NativeJavaReference,
	kind: RowKind,
) {
	'worklet';
	let original = javaText(java.getAssociatedObject(row, config.keys.padding));

	if (!original) {
		original = `${javaNumber(java.invoke(row, 'getPaddingTop', [])) ?? 0},${javaNumber(java.invoke(row, 'getPaddingBottom', [])) ?? 0}`;
		java.setAssociatedObject(row, config.keys.padding, javaString(original));
	}

	const [top, bottom] = original.split(',').map(Number) as [number, number];
	const room = config.rooms[kind];
	const left = javaNumber(java.invoke(row, 'getPaddingLeft', [])) ?? 0;
	const right = javaNumber(java.invoke(row, 'getPaddingRight', [])) ?? 0;
	const accessories = viewIn(java, row, config.ids.accessories_view);
	const margins = accessories
		? javaReference(java.invoke(accessories, 'getLayoutParams', []))
		: null;
	// Each bind sets the content's margins, such as the gap above media; the room replaces them, so a bubble stretched to its row keeps even padding.
	const above =
		margins && kind === 'next' ? (javaNumber(java.getField(margins, 'topMargin')) ?? 0) : 0;
	const below = margins ? (javaNumber(java.getField(margins, 'bottomMargin')) ?? 0) : 0;

	java.invoke(row, 'setPadding', [
		javaInt(left),
		javaInt(Math.max(0, top + Math.round(room.top) - above)),
		javaInt(right),
		javaInt(Math.max(0, bottom + Math.round(room.bottom) - below)),
	]);

	if (!accessories) return;

	const inset = Math.round(config.inset);

	// The content moves in by translation, not padding, so the forward bar Discord draws at a fixed place moves in with it.
	java.invoke(accessories, 'setPadding', [
		javaInt(0),
		javaInt(0),
		javaInt(inset * 2),
		javaInt(0),
	]);
	java.invoke(accessories, 'setTranslationX', [javaFloat(inset)]);
	java.invoke(accessories, 'setClipToPadding', [javaBoolean(inset === 0)]);
}

// The bubble is the background of a 1px view behind the row's other views, so Discord's own background, its press ripple and its jump flash, stays untouched.
function bubbleView(
	java: NativeJavaBridge,
	config: RowConfig,
	row: NativeJavaReference,
	create: boolean,
) {
	'worklet';
	const found = viewIn(java, row, config.layerId);

	if (found || !create) return found;

	const context = javaReference(java.invoke(row, 'getContext', []));

	if (!context) return null;

	const view = java.construct('android.view.View', [context]);

	java.invoke(view, 'setId', [javaInt(config.layerId)]);
	java.invoke(view, 'setImportantForAccessibility', [javaInt(NO_ACCESSIBILITY)]);
	java.invoke(row, 'addView', [
		view,
		javaInt(0),
		java.construct('android.widget.RelativeLayout$LayoutParams', [javaInt(1), javaInt(1)]),
	]);
	// The bubble draws far past its 1px view, and past the row into the room of the rows around it.
	java.invoke(row, 'setClipChildren', [javaBoolean(false)]);

	return view;
}

function setBackground(
	java: NativeJavaBridge,
	config: RowConfig,
	row: NativeJavaReference,
	drawable: NativeJavaReference | null,
) {
	'worklet';
	const view = bubbleView(java, config, row, Boolean(drawable));

	if (!view) return;

	if (!drawable) {
		java.invoke(view, 'setVisibility', [javaInt(GONE)]);

		return;
	}

	const left = javaNumber(java.invoke(row, 'getPaddingLeft', [])) ?? 0;
	const top = javaNumber(java.invoke(row, 'getPaddingTop', [])) ?? 0;

	// A view added outside a layout pass stays unlaid, and draws nothing, until the row next measures; it gets the place the row would give it.
	if (!javaNumber(java.invoke(view, 'getWidth', []))) {
		java.invoke(view, 'layout', [
			javaInt(left),
			javaInt(top),
			javaInt(left + 1),
			javaInt(top + 1),
		]);
	}

	// The view sits inside the row's padding; it moves back to the row's top left, where the bubble's paths start.
	java.invoke(view, 'setTranslationX', [javaFloat(-left)]);
	java.invoke(view, 'setTranslationY', [javaFloat(-top)]);
	java.invoke(view, 'setBackground', [drawable]);
	java.invoke(view, 'setVisibility', [javaInt(VISIBLE)]);
}

function removeBubble(java: NativeJavaBridge, config: RowConfig, row: NativeJavaReference) {
	'worklet';
	const view = bubbleView(java, config, row, false);

	if (!view) return;

	java.invoke(row, 'removeView', [view]);
	java.invoke(row, 'setClipChildren', [javaBoolean(true)]);
}

/**
 * @description Moves a row's name row, time, avatar and reply preview, clips the preview to its quote box and swaps its spine for a reply icon.
 * @param active Whether bubbles paint the row; `false` gives Discord's spine back.
 */
export function moveHeading(
	java: NativeJavaBridge,
	config: RowConfig,
	row: NativeJavaReference,
	paint: Pick<RowPaint, 'name' | 'avatar' | 'reply' | 'time' | 'clip'>,
	active = true,
) {
	'worklet';
	const { ids } = config;
	const preview = viewIn(java, row, ids.reply_preview_view);
	const time = viewIn(java, row, ids.timestamp);

	move(java, viewIn(java, row, ids.header), paint.name);
	move(java, viewIn(java, row, ids.author_avatar), paint.avatar);
	move(java, viewIn(java, row, ids.author_avatar_decoration), paint.avatar);
	move(java, preview, paint.reply);

	if (time) java.invoke(time, 'setTranslationX', [javaFloat(paint.time ?? 0)]);

	if (!preview) return;

	paintReplySpine(
		java,
		config.replyIcon,
		{
			preview,
			spine: viewIn(java, row, ids.reply_spline),
			leading: viewIn(java, row, ids.reply_leading_views),
			text: viewIn(java, row, ids.reply_text),
		},
		{ active, quoted: Boolean(paint.clip) },
	);

	if (!paint.clip) {
		java.invoke(preview, 'setClipBounds', [{ type: 'null', class: 'android.graphics.Rect' }]);

		return;
	}

	const { x, y, width, height } = paint.clip;

	java.invoke(preview, 'setClipBounds', [
		java.construct('android.graphics.Rect', [
			javaInt(Math.round(x)),
			javaInt(Math.round(y)),
			javaInt(Math.round(x + width)),
			javaInt(Math.round(y + height)),
		]),
	]);
}

function setMargin(java: NativeJavaBridge, view: NativeJavaReference, bottom: number) {
	'worklet';
	const params = javaReference(java.invoke(view, 'getLayoutParams', []));

	if (!params || javaNumber(java.getField(params, 'bottomMargin')) === bottom) return;

	java.setField(params, 'bottomMargin', javaInt(bottom));
	java.invoke(view, 'setLayoutParams', [params]);
}

// Discord sizes the decoration by pinning it to the avatar's edges, which would grow the row to the avatar's bottom; freed from that edge, it keeps its size and its negative margin cancels its height.
function freeDecoration(java: NativeJavaBridge, view: NativeJavaReference, height: number) {
	'worklet';
	const params = javaReference(java.invoke(view, 'getLayoutParams', []));

	if (!params) return;

	const top = javaNumber(java.getField(params, 'topMargin')) ?? 0;

	java.invoke(params, 'removeRule', [javaInt(ALIGN_BOTTOM)]);
	java.setField(params, 'height', javaInt(Math.round(height - top)));
	java.invoke(view, 'setLayoutParams', [params]);
}

function pinDecoration(java: NativeJavaBridge, view: NativeJavaReference, avatarId: number) {
	'worklet';
	const params = javaReference(java.invoke(view, 'getLayoutParams', []));

	if (!params) return;

	java.invoke(params, 'addRule', [javaInt(ALIGN_BOTTOM), javaInt(avatarId)]);
	java.invoke(view, 'setLayoutParams', [params]);
}

/**
 * @description Puts back the avatar a row's group moved: shows the first row's again and hides the copy a last row showed.
 */
export function resetAvatar(
	java: NativeJavaBridge,
	config: RowConfig,
	row: NativeJavaReference,
	kind: RowKind | undefined,
) {
	'worklet';
	const state = javaText(java.getAssociatedObject(row, config.keys.avatar));

	if (!state) return;

	java.setAssociatedObject(row, config.keys.avatar, { type: 'null' });

	const decoration = viewIn(java, row, config.ids.author_avatar_decoration);

	if (decoration && state === 'copy') pinDecoration(java, decoration, config.ids.author_avatar);

	for (const id of [config.ids.author_avatar, config.ids.author_avatar_decoration]) {
		const view = viewIn(java, row, id);

		if (!view) continue;

		setMargin(java, view, 0);

		// Discord shows the avatar only on a row that starts a group; a reused row may now show another kind of message.
		java.invoke(view, 'setVisibility', [
			javaInt(kind === 'first' || kind === 'reply' ? VISIBLE : GONE),
		]);
	}
}

// The copy keeps the row's height: its negative margin cancels its own height.
function showCopy(
	java: NativeJavaBridge,
	view: NativeJavaReference,
	url: string | undefined,
	height: number,
	taps: AuthorTaps | undefined,
) {
	'worklet';
	// Without the author's picture, the reused view would show whoever it showed last.
	if (!url) {
		java.invoke(view, 'setVisibility', [javaInt(GONE)]);

		return;
	}

	java.invoke(view, 'setVisibility', [javaInt(VISIBLE)]);
	setMargin(java, view, -Math.round(height * 2));
	java.invoke(view, 'setImageURI', [javaString(url)]);

	if (!taps) return;

	java.invoke(view, 'setTag', [javaInt(CLICK_TAG), taps.click ?? { type: 'null' }]);
	java.invoke(view, 'setTag', [javaInt(LONG_CLICK_TAG), taps.long ?? { type: 'null' }]);

	if (taps.touch) {
		java.invoke(view, 'setOnTouchListener', [
			java.construct(taps.touch, [view, javaBoolean(true)]),
		]);
	}
}

/**
 * @description Moves a group's avatar to its last bubble: hides it on the group's first row, and on its last row shows Discord's own avatar view with the author's picture, decoration and taps, level with the bubble's bottom.
 */
export function placeAvatar(
	java: NativeJavaBridge,
	config: RowConfig,
	row: NativeJavaReference,
	picture: NonNullable<RowPaint['picture']>,
	info: MessageInfo | undefined,
	taps: AuthorTaps | undefined,
) {
	'worklet';
	const avatar = viewIn(java, row, config.ids.author_avatar);
	const decoration = viewIn(java, row, config.ids.author_avatar_decoration);

	if (!avatar) return;

	if (!picture.end) {
		if (!picture.start) return;

		java.setAssociatedObject(row, config.keys.avatar, javaString('hidden'));
		java.invoke(avatar, 'setVisibility', [javaInt(INVISIBLE)]);

		if (decoration) java.invoke(decoration, 'setVisibility', [javaInt(INVISIBLE)]);

		return;
	}

	const shift = { x: 0, y: picture.bottom - picture.top - picture.height };

	if (!picture.start) {
		java.setAssociatedObject(row, config.keys.avatar, javaString('copy'));
		showCopy(java, avatar, info?.avatar, picture.height, taps);

		if (decoration) {
			freeDecoration(java, decoration, picture.height);
			showCopy(java, decoration, info?.decoration, picture.height, undefined);
		}
	}

	move(java, avatar, shift);
	move(java, decoration, shift);
}

/**
 * @description Reads the taps Discord gave a group's first avatar, for the copy by its last bubble.
 */
export function readTaps(
	java: NativeJavaBridge,
	config: RowConfig,
	row: NativeJavaReference,
): AuthorTaps | undefined {
	'worklet';
	const avatar = viewIn(java, row, config.ids.author_avatar);

	if (!avatar) return;

	const listeners = javaReference(java.getField(avatar, 'mListenerInfo'));
	const touch = listeners ? javaReference(java.getField(listeners, 'mOnTouchListener')) : null;

	return {
		click: javaReference(java.invoke(avatar, 'getTag', [javaInt(CLICK_TAG)])),
		long: javaReference(java.invoke(avatar, 'getTag', [javaInt(LONG_CLICK_TAG)])),
		touch: touch ? javaText(java.className(touch)) : undefined,
	};
}

/**
 * @description Rounds a media mosaic's corners to a radius, keeping Discord's own outline to put back, or puts it back.
 * @param radius The radius in pixels, or `undefined` for Discord's own.
 */
export function roundMosaic(
	java: NativeJavaBridge,
	config: RowConfig,
	mosaic: NativeJavaReference,
	radius: number | undefined,
) {
	'worklet';
	const { media, mediaRadius } = config.keys;
	const saved = javaReference(java.getAssociatedObject(mosaic, media));
	const rounded = radius === undefined ? undefined : String(Math.round(radius));

	if (javaText(java.getAssociatedObject(mosaic, mediaRadius)) === rounded) return;

	if (rounded === undefined) {
		java.setAssociatedObject(mosaic, media, { type: 'null' });
		java.setAssociatedObject(mosaic, mediaRadius, { type: 'null' });

		if (saved) java.invoke(mosaic, 'setOutlineProvider', [saved]);

		return;
	}

	const own = saved ?? javaReference(java.invoke(mosaic, 'getOutlineProvider', []));
	const className = own ? javaText(java.className(own)) : undefined;

	if (!own || !className) return;

	java.setAssociatedObject(mosaic, media, own);
	java.setAssociatedObject(mosaic, mediaRadius, javaString(rounded));
	// Discord's outline takes its radius when built, so a new one of its kind rounds the mosaic and its own stays untouched.
	java.invoke(mosaic, 'setOutlineProvider', [
		java.construct(className, [javaInt(Number(rounded))]),
	]);
}

/**
 * @description Paints a row: its bubble as the background, or Discord's own background without one.
 */
export function paintBackground(
	java: NativeJavaBridge,
	config: RowConfig,
	row: NativeJavaReference,
	drawable: NativeJavaReference | null,
) {
	'worklet';
	setBackground(java, config, row, drawable);
}

/**
 * @description Puts a row back the way Discord laid it out: its padding, background, moves, clip and avatar.
 */
export function restoreRow(java: NativeJavaBridge, config: RowConfig, row: NativeJavaReference) {
	'worklet';
	const none = { x: 0, y: 0 };
	const original = javaText(java.getAssociatedObject(row, config.keys.padding));

	removeBubble(java, config, row);

	const mosaic = viewIn(java, row, config.ids.mosaic);

	if (mosaic) roundMosaic(java, config, mosaic, undefined);

	moveHeading(java, config, row, { name: none, avatar: none, reply: none }, false);
	resetAvatar(java, config, row, rowKind(java, config, row));

	if (original) {
		const [top, bottom] = original.split(',').map(Number) as [number, number];

		java.setAssociatedObject(row, config.keys.padding, { type: 'null' });
		java.invoke(row, 'setPadding', [
			javaInt(javaNumber(java.invoke(row, 'getPaddingLeft', [])) ?? 0),
			javaInt(top),
			javaInt(javaNumber(java.invoke(row, 'getPaddingRight', [])) ?? 0),
			javaInt(bottom),
		]);
	}

	const accessories = viewIn(java, row, config.ids.accessories_view);

	if (accessories) {
		java.invoke(accessories, 'setPadding', [javaInt(0), javaInt(0), javaInt(0), javaInt(0)]);
		java.invoke(accessories, 'setTranslationX', [javaFloat(0)]);
		java.invoke(accessories, 'setClipToPadding', [javaBoolean(true)]);
	}
}

export default {
	padRow,
	moveHeading,
	placeAvatar,
	resetAvatar,
	readTaps,
	paintBackground,
	roundMosaic,
	restoreRow,
	rowKind,
	viewIn,
};
