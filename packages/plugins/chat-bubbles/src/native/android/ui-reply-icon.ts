import type { NativeJavaBridge, NativeJavaReference } from '@unbound-app/api/native';
import {
	javaFloat,
	javaInt,
	javaNumber,
	javaReference,
} from '@unbound-plugins/shared/native/android/java-values';

const VISIBLE = 0;
const GONE = 8;
const NO_ACCESSIBILITY = 2;

/** The reply icon's drawable, 0 when Discord has none, its view id, and its size and gap before the preview's avatar, in pixels. */
export type ReplyIconConfig = { drawable: number; id: number; size: number; gap: number };

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

function replyIconIn(
	java: NativeJavaBridge,
	config: ReplyIconConfig,
	preview: NativeJavaReference,
	create: boolean,
) {
	'worklet';
	const { id, drawable, size } = config;
	const found = findView(java, preview, id);

	if (found || !create || !drawable) return found;

	const context = javaReference(java.invoke(preview, 'getContext', []));

	if (!context) return null;

	const icon = java.construct('android.widget.ImageView', [context]);

	java.invoke(icon, 'setId', [javaInt(id)]);
	java.invoke(icon, 'setImportantForAccessibility', [javaInt(NO_ACCESSIBILITY)]);
	java.invoke(icon, 'setImageResource', [javaInt(drawable)]);
	java.invoke(preview, 'addView', [
		icon,
		java.construct('android.view.ViewGroup$LayoutParams', [javaInt(size), javaInt(size)]),
	]);
	// A view added outside a layout pass draws nothing until the preview next measures, so it takes its size now.
	java.invoke(icon, 'layout', [javaInt(0), javaInt(0), javaInt(size), javaInt(size)]);

	return icon;
}

function numberOf(java: NativeJavaBridge, view: NativeJavaReference | null, getter: string) {
	'worklet';

	return view ? javaNumber(java.invoke(view, getter, [])) : undefined;
}

/**
 * @description Swaps a reply preview's branching spine for a reply icon before its avatar while bubbles paint the row, or hides both while the preview sits in a quote box.
 * @param java The plugin's Java bridge.
 * @param config The icon's drawable, view id and size.
 * @param views The reply preview's views.
 * @param state Whether bubbles paint the row, `false` giving Discord's spine back, and whether the preview is quoted.
 */
export function paintReplySpine(
	java: NativeJavaBridge,
	config: ReplyIconConfig,
	{ preview, spine, leading, text }: ReplyViews,
	{ active, quoted }: { active: boolean; quoted: boolean },
) {
	'worklet';
	const showIcon = active && !quoted;

	if (spine) java.invoke(spine, 'setAlpha', [javaFloat(active ? 0 : 1)]);

	const icon = replyIconIn(java, config, preview, showIcon);

	if (!icon) return;

	java.invoke(icon, 'setVisibility', [javaInt(showIcon ? VISIBLE : GONE)]);

	if (!showIcon) return;

	const { size, gap } = config;
	const left = numberOf(java, leading, 'getLeft') ?? 0;
	const top = numberOf(java, leading, 'getTop') ?? 0;
	const height = numberOf(java, leading, 'getHeight') ?? size;
	const color = numberOf(java, text, 'getCurrentTextColor');

	// The icon takes the reply text's muted color, and centres on the preview's avatar.
	if (color !== undefined) java.invoke(icon, 'setColorFilter', [javaInt(color)]);

	java.invoke(icon, 'setTranslationX', [javaFloat(left - gap - size)]);
	java.invoke(icon, 'setTranslationY', [javaFloat(top + (height - size) / 2)]);
}

export default { paintReplySpine };
