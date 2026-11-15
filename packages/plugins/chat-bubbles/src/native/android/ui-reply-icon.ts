import type {
	NativeJavaBridge,
	NativeJavaReference,
	NativeJavaValue,
} from '@unbound-app/api/native';
import {
	javaBoolean,
	javaFlag,
	javaFloat,
	javaInt,
	javaNumber,
	javaReference,
} from '@unbound-plugins/shared/native/android/java-values';

const VISIBLE = 0;
const GONE = 8;
const NO_ACCESSIBILITY = 2;
const CENTER_VERTICAL = 16;

/** The reply icon's drawable, 0 when Discord has none, its view id, and its size and gap before the preview's avatar, in pixels. */
export type ReplyIconConfig = { drawable: number; id: number; size: number; gap: number };

/** A reply preview drawn as its own bubble: its ARGB color, radius and padding around the avatar and text, in pixels. */
export type ReplyBubblePaint = { color: number; radius: number; padding: number };

/** A reply preview's views: the preview, its spine, the views before its text, starting with its avatar, and its text. */
export type ReplyViews = {
	preview: NativeJavaReference;
	spine: NativeJavaReference | null;
	leading: NativeJavaReference | null;
	text: NativeJavaReference | null;
};

function findView(java: NativeJavaBridge, parent: NativeJavaReference, id: number) {
	'worklet';

	return javaReference(java.invoke(parent, 'findViewById', [javaInt(id)]));
}

function isInstance(java: NativeJavaBridge, className: string, view: NativeJavaReference) {
	'worklet';

	return javaFlag(java.invoke(java.getClass(className), 'isInstance', [view]));
}

function addBeforeLeading(
	java: NativeJavaBridge,
	{ size, gap }: ReplyIconConfig,
	preview: NativeJavaReference,
	leading: NativeJavaReference,
	icon: NativeJavaReference,
) {
	'worklet';
	const params = java.construct('android.widget.LinearLayout$LayoutParams', [
		javaInt(size),
		javaInt(size),
	]);

	java.setField(params, 'gravity', javaInt(CENTER_VERTICAL));
	java.invoke(params, 'setMarginStart', [javaInt(-(size + gap))]);
	java.invoke(params, 'setMarginEnd', [javaInt(gap)]);
	java.invoke(leading, 'addView', [icon, javaInt(0), params]);
	java.invoke(leading, 'setClipToPadding', [javaBoolean(false)]);
	java.invoke(leading, 'setClipChildren', [javaBoolean(false)]);
	java.invoke(preview, 'setClipChildren', [javaBoolean(false)]);
}

function addToPreview(
	java: NativeJavaBridge,
	{ size }: ReplyIconConfig,
	preview: NativeJavaReference,
	icon: NativeJavaReference,
) {
	'worklet';
	java.invoke(preview, 'addView', [
		icon,
		java.construct('android.view.ViewGroup$LayoutParams', [javaInt(size), javaInt(size)]),
	]);
	// A view added outside a layout pass draws nothing until the preview next measures, so it takes its size now.
	java.invoke(icon, 'layout', [javaInt(0), javaInt(0), javaInt(size), javaInt(size)]);
}

function replyIconIn(
	java: NativeJavaBridge,
	config: ReplyIconConfig,
	{ preview, leading }: ReplyViews,
	create: boolean,
) {
	'worklet';
	const { id, drawable } = config;
	const found = findView(java, preview, id);

	if (found || !create || !drawable) return found;

	// An unexpanded reply preview is still a ViewStub placeholder, which holds no children.
	if (!isInstance(java, 'android.view.ViewGroup', preview)) return null;

	const context = javaReference(java.invoke(preview, 'getContext', []));

	if (!context) return null;

	const icon = java.construct('android.widget.ImageView', [context]);

	java.invoke(icon, 'setId', [javaInt(id)]);
	java.invoke(icon, 'setImportantForAccessibility', [javaInt(NO_ACCESSIBILITY)]);
	java.invoke(icon, 'setImageResource', [javaInt(drawable)]);

	if (leading && isInstance(java, 'android.widget.LinearLayout', leading)) {
		addBeforeLeading(java, config, preview, leading, icon);
	} else {
		addToPreview(java, config, preview, icon);
	}

	return icon;
}

function numberOf(java: NativeJavaBridge, view: NativeJavaReference | null, getter: string) {
	'worklet';

	return view ? javaNumber(java.invoke(view, getter, [])) : undefined;
}

function placeInPreview(
	java: NativeJavaBridge,
	{ size, gap }: ReplyIconConfig,
	leading: NativeJavaReference | null,
	icon: NativeJavaReference,
) {
	'worklet';
	const left = numberOf(java, leading, 'getLeft') ?? 0;
	const top = numberOf(java, leading, 'getTop') ?? 0;
	const height = numberOf(java, leading, 'getHeight') ?? size;

	java.invoke(icon, 'setTranslationX', [javaFloat(left - gap - size)]);
	java.invoke(icon, 'setTranslationY', [javaFloat(top + (height - size) / 2)]);
}

const NO_BACKGROUND = { type: 'null', class: 'android.graphics.drawable.Drawable' } as const;

function setBackgroundKeepingPadding(
	java: NativeJavaBridge,
	view: NativeJavaReference,
	background: NativeJavaReference | NativeJavaValue,
) {
	'worklet';
	const padding = ['getPaddingLeft', 'getPaddingTop', 'getPaddingRight', 'getPaddingBottom'].map(
		(getter) => javaInt(numberOf(java, view, getter) ?? 0),
	);

	java.invoke(view, 'setBackground', [background]);
	java.invoke(view, 'setPadding', padding);
}

function bubbleDrawable(java: NativeJavaBridge, { color, radius, padding }: ReplyBubblePaint) {
	'worklet';
	const shape = java.construct('android.graphics.drawable.GradientDrawable', []);

	java.invoke(shape, 'setColor', [javaInt(color)]);
	java.invoke(shape, 'setCornerRadius', [javaFloat(radius)]);

	return java.construct('android.graphics.drawable.InsetDrawable', [
		shape,
		javaInt(-Math.round(padding)),
		javaInt(0),
		javaInt(-Math.round(padding)),
		javaInt(0),
	]);
}

function paintReplyBubble(
	java: NativeJavaBridge,
	{ preview, leading, text }: ReplyViews,
	bubble: ReplyBubblePaint | undefined,
) {
	'worklet';

	if (!text) return;

	if (leading) java.invoke(leading, 'setTranslationZ', [javaFloat(bubble ? 1 : 0)]);

	if (!bubble) {
		setBackgroundKeepingPadding(java, text, NO_BACKGROUND);

		return;
	}

	setBackgroundKeepingPadding(java, text, bubbleDrawable(java, bubble));
	java.invoke(preview, 'setClipChildren', [javaBoolean(false)]);
}

/**
 * @description Swaps a reply preview's branching spine for a reply icon before its avatar while bubbles paint the row, hides both while the preview sits in a quote box,
 * or keeps the spine and draws the preview as its own bubble.
 * @param java The plugin's Java bridge.
 * @param config The icon's drawable, view id and size.
 * @param views The reply preview's views.
 * @param state Whether bubbles paint the row, `false` giving Discord's spine back, whether the preview is quoted, the reply bubble to draw,
 * and whether a bubble already drawn stays, as while the row waits to be measured.
 */
export function paintReplySpine(
	java: NativeJavaBridge,
	config: ReplyIconConfig,
	views: ReplyViews,
	{
		active,
		quoted,
		bubble,
		keep = false,
	}: { active: boolean; quoted: boolean; bubble?: ReplyBubblePaint; keep?: boolean },
) {
	'worklet';
	const { preview, spine, leading, text } = views;
	// A recycled row keeps its preview after Discord empties it for a message that replies to nothing.
	const isReply =
		numberOf(java, preview, 'getVisibility') === VISIBLE &&
		numberOf(java, leading, 'getVisibility') === VISIBLE;
	const kept =
		keep && !bubble && Boolean(text && javaReference(java.invoke(text, 'getBackground', [])));
	const bubbled = active && !quoted && isReply && (Boolean(bubble) || kept);
	const showIcon = active && !quoted && isReply && !bubbled;

	if (spine) java.invoke(spine, 'setAlpha', [javaFloat(active && !bubbled ? 0 : 1)]);

	if (!kept) paintReplyBubble(java, views, bubbled ? bubble : undefined);

	const icon = replyIconIn(java, config, views, showIcon);

	if (!icon) return;

	java.invoke(icon, 'setVisibility', [javaInt(showIcon ? VISIBLE : GONE)]);

	if (!showIcon) return;

	const color = numberOf(java, text, 'getCurrentTextColor');

	// The icon takes the reply text's muted color.
	if (color !== undefined) java.invoke(icon, 'setColorFilter', [javaInt(color)]);

	const parent = javaReference(java.invoke(icon, 'getParent', []));

	if (parent && javaFlag(java.invoke(preview, 'equals', [parent]))) {
		placeInPreview(java, config, leading, icon);
	}
}

export default { paintReplySpine };
