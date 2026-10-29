import type {
	NativeJavaBridge,
	NativeJavaHookToken,
	NativeJavaReference,
	PluginContext,
} from '@unbound-app/api/native';
import {
	javaFloat,
	javaInt,
	javaNumber,
	javaReference,
	javaText,
	sameJavaReference,
} from '@unbound-plugins/shared/native/android/java-values';
import {
	currentDecorView,
	findViewsOfClass,
	scheduleStartupScans,
} from '@unbound-plugins/shared/native/android/views';
import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import { shapeMethod } from '@unbound-plugins/shared/native/android/discord-shapes';

import type { LabelAppearances } from '~/label-appearances';
import { HEX_COLOR } from '~/constants';

const TAG_VIEW = 'com.discord.chat.presentation.message.MessageTagView';
const GRADIENT = 'android.graphics.drawable.GradientDrawable';
const ORIENTATION = 'android.graphics.drawable.GradientDrawable$Orientation';
const PAINT_DRAWABLE = 'android.graphics.drawable.PaintDrawable';
const TEXT_VIEW = 'android.widget.TextView';

type Painted = {
	layout: NativeJavaReference;
	original: NativeJavaReference;
	gradient: NativeJavaReference;
};

/**
 * @description Converts a `#rrggbb` color to the signed ARGB `int` Android drawables take.
 * @param hex The color.
 * @returns The opaque color as a signed 32-bit integer.
 */
export function androidColor(hex: string): number {
	return 0xff000000 | Number.parseInt(hex.slice(1, 7), 16) | 0;
}

/**
 * @description Converts an ARGB `int` read from Android back to `#rrggbb`, dropping its alpha.
 * @param color The signed or unsigned color.
 * @returns The lowercase hex color.
 */
export function hexColor(color: number): string {
	return `#${((color >>> 0) & 0xffffff).toString(16).padStart(6, '0')}`;
}

function viewKey(view: NativeJavaReference): string {
	return 'value' in view ? String(view.value) : '';
}

function className(java: NativeJavaBridge, value: NativeJavaReference): string | undefined {
	const type = javaReference(java.invoke(value, 'getClass', []));

	return type ? javaText(java.invoke(type, 'getName', [])) : undefined;
}

function cornerRadius(java: NativeJavaBridge, drawable: NativeJavaReference): number {
	const shape = javaReference(java.invoke(drawable, 'getShape', []));
	const radii = shape ? javaReference(java.getField(shape, 'mOuterRadii')) : null;
	const reflectArray = java.getClass('java.lang.reflect.Array');

	if (!radii || !reflectArray) return 0;

	return javaNumber(java.invoke(reflectArray, 'getFloat', [radii, javaInt(0)])) ?? 0;
}

/**
 * @description Draws role-color gradients behind Discord's native message tags on Android, re-applying them after each tag bind since Discord gives the tag a fresh solid background every time.
 * @param context The plugin context, whose Java bridge draws the gradients.
 * @param appearances The colors the tag patch chose for each tag text.
 * @returns A function that removes the hook and restores every tag it painted.
 */
export function startAndroidTagGradients(
	context: PluginContext,
	appearances: LabelAppearances,
): () => Promise<void> {
	if (!ensureCapabilities('More User Tags: gradients', context.native, context.capabilities)) {
		return async () => {};
	}

	const { java, hooks } = context.native;
	const bind = shapeMethod(java, 'messageTagBind');
	const orientationClass = java.getClass(ORIENTATION);
	const leftToRight = orientationClass
		? javaReference(java.getField(orientationClass, 'LEFT_RIGHT'))
		: null;

	if (!bind || !leftToRight) {
		console.error('[More User Tags: gradients] Skipped, the Android tag view was not found.');

		return async () => {};
	}

	const painted = new Map<string, Painted>();
	let stopped = false;

	async function paint(tagView: NativeJavaReference, text: string) {
		const layout = javaReference(java.invoke(tagView, 'getChildAt', [javaInt(0)]));
		const background = layout ? javaReference(java.invoke(layout, 'getBackground', [])) : null;
		const key = viewKey(tagView);

		if (!layout || !background || className(java, background) !== PAINT_DRAWABLE) return;

		const paintHandle = javaReference(java.invoke(background, 'getPaint', []));
		const color = paintHandle
			? javaNumber(java.invoke(paintHandle, 'getColor', []))
			: undefined;
		const found = appearances.find(text, color === undefined ? null : hexColor(color));
		const colors = found?.appearance.colors.filter((value) => HEX_COLOR.test(value)) ?? [];

		if (colors.length < 2) {
			painted.delete(key);

			return;
		}

		const gradient = java.construct(GRADIENT, [
			leftToRight!,
			{ type: 'array', componentType: 'int', value: colors.map(androidColor) },
		]);

		java.invoke(gradient, 'setCornerRadius', [javaFloat(cornerRadius(java, background))]);

		if (stopped) return;

		await java.invokeAsync(layout, 'setBackground', [gradient]);
		painted.set(key, { layout, original: background, gradient });
	}

	const token: NativeJavaHookToken = hooks.hook(
		TAG_VIEW,
		bind.name,
		bind.parameters,
		{ notify: true },
		({ self, args }) => {
			const tagView = javaReference(self);
			const text = javaText(args[0]);

			if (!tagView || !text || stopped) return;

			paint(tagView, text).catch((error) => {
				console.error('[More User Tags: gradients] Failed to paint an Android tag:', error);
			});
		},
	);

	async function tagText(tagView: NativeJavaReference): Promise<string | undefined> {
		const [label] = await findViewsOfClass(java, tagView, TEXT_VIEW);
		const text = label ? javaReference(java.invoke(label, 'getText', [])) : null;

		return text ? javaText(java.invoke(text, 'toString', [])) : undefined;
	}

	async function scanVisible() {
		const decor = currentDecorView(java);

		if (!decor || stopped) return;

		for (const tagView of await findViewsOfClass(java, decor, TAG_VIEW)) {
			const text = await tagText(tagView);

			if (text) {
				paint(tagView, text).catch(() => undefined);
			}
		}
	}

	const scans = scheduleStartupScans('More User Tags', scanVisible);

	return async () => {
		stopped = true;
		hooks.remove(token);

		for (const scan of scans) clearTimeout(scan);

		for (const { layout, original, gradient } of painted.values()) {
			const current = javaReference(java.invoke(layout, 'getBackground', []));

			if (current && sameJavaReference(current, gradient)) {
				await java.invokeAsync(layout, 'setBackground', [original]).catch(() => undefined);
			}
		}

		painted.clear();
	};
}
