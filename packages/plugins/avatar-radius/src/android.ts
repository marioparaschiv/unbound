import type {
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeJavaReference,
	NativeJavaValue,
} from '@unbound-app/api/native';
import { currentDecorView, findViewsOfClass } from '@unbound-plugins/shared/native/android/views';
import {
	javaBoolean,
	javaFlag,
	javaFloat,
	javaInt,
	javaNumber,
	javaReference,
	javaText,
} from '@unbound-plugins/shared/native/android/java-values';

import { AvatarClass, PLUGIN_NAME } from '~/constants';

type AndroidNative = {
	java: NativeJavaBridge;
	hooks: NativeJavaHooksBridge;
};

const PROBE_SIZE = 100;
const MAX_TRACKED = 512;

function isMissing(value: NativeJavaValue | null | undefined): boolean {
	return !value || value.type === 'null';
}

/**
 * @description Rounds Discord's circular avatar views to the chosen radius as they attach to a window.
 * @param native The plugin's Java and hook bridges.
 * @param radius Reads the chosen radius in density-independent pixels.
 * @returns `refresh`, which re-rounds the avatars it rounded, and `dispose`, which brings back the circles.
 */
export function roundAndroidAvatars({ java, hooks }: AndroidNative, radius: () => number) {
	const avatarClass = java.getClass(AvatarClass.android);
	const attachClass = java.describe(AvatarClass.android).superclass ?? AvatarClass.android;
	const backgroundOutline = java.getField(
		java.getClass('android.view.ViewOutlineProvider'),
		'BACKGROUND',
	);
	const originalOutline = java.createAssociationKey();
	const originalBackground = java.createAssociationKey();
	const circles = new Map<string, boolean>();
	const tracked: NativeJavaReference[] = [];
	let disposed = false;

	function isCircle(provider: NativeJavaReference, view: NativeJavaReference): boolean {
		const name = javaText(java.className(provider)) ?? '';
		const known = circles.get(name);

		if (known !== undefined) return known;

		const context = javaReference(java.invoke(view, 'getContext', []));
		const probe = java.construct('android.view.View', context ? [context] : []);
		const outline = java.construct('android.graphics.Outline', []);
		const bounds = java.construct('android.graphics.Rect', []);

		java.invoke(probe, 'layout', [
			javaInt(0),
			javaInt(0),
			javaInt(PROBE_SIZE),
			javaInt(PROBE_SIZE),
		]);
		java.invoke(provider, 'getOutline', [probe, outline]);

		const circle =
			javaFlag(java.invoke(outline, 'getRect', [bounds])) &&
			javaNumber(java.invoke(bounds, 'width', [])) === PROBE_SIZE &&
			javaNumber(java.invoke(bounds, 'height', [])) === PROBE_SIZE &&
			javaNumber(java.invoke(outline, 'getRadius', [])) === PROBE_SIZE / 2;

		circles.set(name, circle);

		return circle;
	}

	function track(view: NativeJavaReference) {
		tracked.push(view);

		if (tracked.length > MAX_TRACKED) tracked.shift();
	}

	function adopt(view: NativeJavaReference): boolean {
		if (!isMissing(java.getAssociatedObject(view, originalOutline))) return true;

		const provider = javaReference(java.invoke(view, 'getOutlineProvider', []));

		if (!provider || !isCircle(provider, view)) return false;

		java.setAssociatedObject(view, originalOutline, provider);
		java.setAssociatedObject(view, originalBackground, java.invoke(view, 'getBackground', []));
		track(view);

		return true;
	}

	async function round(view: NativeJavaReference) {
		if (disposed || !adopt(view)) return;

		const resources = javaReference(java.invoke(view, 'getResources', []));
		const metrics = resources
			? javaReference(java.invoke(resources, 'getDisplayMetrics', []))
			: null;
		const density = metrics ? (javaNumber(java.getField(metrics, 'density')) ?? 1) : 1;
		const background = java.construct('android.graphics.drawable.GradientDrawable', []);

		java.invoke(background, 'setCornerRadius', [javaFloat(radius() * density)]);
		java.invoke(background, 'setColor', [javaInt(0)]);

		await java.invokeAsync(view, 'setBackground', [background]);
		await java.invokeAsync(view, 'setOutlineProvider', [backgroundOutline]);
		await java.invokeAsync(view, 'setClipToOutline', [javaBoolean(true)]);
		await java.invokeAsync(view, 'invalidateOutline', []);
	}

	async function restore(view: NativeJavaReference) {
		const provider = java.getAssociatedObject(view, originalOutline);

		if (isMissing(provider)) return;

		const background = java.getAssociatedObject(view, originalBackground);

		await java.invokeAsync(view, 'setBackground', [
			isMissing(background)
				? { type: 'null', class: 'android.graphics.drawable.Drawable' }
				: background,
		]);
		await java.invokeAsync(view, 'setOutlineProvider', [provider]);
		await java.invokeAsync(view, 'invalidateOutline', []);
	}

	function report(error: unknown) {
		console.error(`[${PLUGIN_NAME}] Failed to round an avatar:`, error);
	}

	const token = hooks.hook(
		attachClass,
		'onAttachedToWindow',
		[],
		{ notify: true },
		({ self }) => {
			const view = javaReference(self);

			if (view && javaFlag(java.invoke(avatarClass, 'isInstance', [view]))) {
				round(view).catch(report);
			}
		},
	);

	const root = currentDecorView(java);

	if (root) {
		for (const view of findViewsOfClass(java, root, AvatarClass.android))
			round(view).catch(report);
	}

	return {
		refresh() {
			for (const view of tracked) round(view).catch(report);
		},
		async dispose() {
			disposed = true;
			hooks.remove(token);

			await Promise.all(tracked.splice(0).map((view) => restore(view).catch(report)));
		},
	};
}

export default { roundAndroidAvatars };
