import { isCancellation } from '@unbound-plugins/shared/native/cancellation';
import type {
	NativeJavaArgument,
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
import { mayBeAvatar } from '~/image-sources';

type AndroidNative = {
	java: NativeJavaBridge;
	hooks: NativeJavaHooksBridge;
};

type Rounded =
	| { kind: 'outline'; view: NativeJavaReference }
	| { kind: 'border'; view: NativeJavaReference; circle: number };

const PROBE_SIZE = 100;
const MAX_TRACKED = 512;
const CORNER_PROBE = 0.135;
const SIZE_RETRIES = 3;
const SIZE_RETRY_MS = 50;
const SQUARE_TOLERANCE = 1;

function isMissing(value: NativeJavaValue | null | undefined): boolean {
	return !value || value.type === 'null';
}

function isBorderRadiusSetter(method: {
	name: string;
	static?: boolean;
	parameters: string[];
}): boolean {
	return (
		!method.static &&
		method.name === 'setBorderRadius' &&
		method.parameters.length === 1 &&
		method.parameters[0] === 'float'
	);
}

/**
 * @description Rounds Discord's circular avatars to the chosen radius as they attach to a window: the native chat avatars through their outline, and React Native images everywhere else through their border radius.
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
	const roundedBorder = java.createAssociationKey();
	const circles = new Map<string, boolean>();
	const borderClasses = new Map<string, boolean>();
	const sourcePaths = new Map<string, { holder: string; uri: string } | null>();
	const tracked: Rounded[] = [];
	let disposed = false;

	function onMain(handle: NativeJavaReference, name: string, args: NativeJavaArgument[] = []) {
		return java.invokeAsync(handle, name, args);
	}

	async function isCircle(
		provider: NativeJavaReference,
		view: NativeJavaReference,
	): Promise<boolean> {
		const name = javaText(java.className(provider)) ?? '';
		const known = circles.get(name);

		if (known !== undefined) return known;

		const context = javaReference(await onMain(view, 'getContext'));
		const probe = java.construct('android.view.View', context ? [context] : []);
		const outline = java.construct('android.graphics.Outline', []);
		const bounds = java.construct('android.graphics.Rect', []);

		await onMain(probe, 'layout', [
			javaInt(0),
			javaInt(0),
			javaInt(PROBE_SIZE),
			javaInt(PROBE_SIZE),
		]);
		await onMain(provider, 'getOutline', [probe, outline]);

		const circle =
			javaFlag(java.invoke(outline, 'getRect', [bounds])) &&
			javaNumber(java.invoke(bounds, 'width', [])) === PROBE_SIZE &&
			javaNumber(java.invoke(bounds, 'height', [])) === PROBE_SIZE &&
			javaNumber(java.invoke(outline, 'getRadius', [])) === PROBE_SIZE / 2;

		circles.set(name, circle);

		return circle;
	}

	function track(rounded: Rounded) {
		tracked.push(rounded);

		if (tracked.length > MAX_TRACKED) tracked.shift();
	}

	async function adoptOutline(view: NativeJavaReference): Promise<Rounded | null> {
		if (!isMissing(java.getAssociatedObject(view, originalOutline))) {
			return { kind: 'outline', view };
		}

		const provider = javaReference(await onMain(view, 'getOutlineProvider'));

		if (!provider || !(await isCircle(provider, view))) return null;

		java.setAssociatedObject(view, originalOutline, provider);
		java.setAssociatedObject(view, originalBackground, await onMain(view, 'getBackground'));

		const rounded: Rounded = { kind: 'outline', view };

		track(rounded);

		return rounded;
	}

	function hasBorderRadius(view: NativeJavaReference): boolean {
		const name = javaText(java.className(view)) ?? '';
		const known = borderClasses.get(name);

		if (known !== undefined) return known;

		let supported = false;

		for (let current: string | null | undefined = name; current && current !== attachClass;) {
			const description = java.describe(current);

			supported = description.methods.some(isBorderRadiusSetter);

			if (supported) break;

			current = description.superclass;
		}

		borderClasses.set(name, supported);

		return supported;
	}

	function regionContains(region: NativeJavaReference, x: number, y: number): boolean {
		return javaFlag(java.invoke(region, 'contains', [javaInt(x), javaInt(y)]));
	}

	async function clipsToCircle(view: NativeJavaReference, size: number): Promise<boolean> {
		const background = javaReference(await onMain(view, 'getBackground'));

		if (!background) return false;

		const outline = java.construct('android.graphics.Outline', []);

		await onMain(background, 'getOutline', [outline]);

		const path = javaReference(java.getField(outline, 'mPath'));

		if (!path) return false;

		const bounds = java.construct('android.graphics.Region', [
			javaInt(0),
			javaInt(0),
			javaInt(size),
			javaInt(size),
		]);
		const region = java.construct('android.graphics.Region', []);

		java.invoke(region, 'setPath', [path, bounds]);

		const corner = Math.floor(size * CORNER_PROBE);
		const center = Math.floor(size / 2);

		return !regionContains(region, corner, corner) && regionContains(region, center, center);
	}

	async function squareSize(view: NativeJavaReference): Promise<number> {
		const width = javaNumber(await onMain(view, 'getWidth')) ?? 0;
		const height = javaNumber(await onMain(view, 'getHeight')) ?? 0;

		return Math.abs(width - height) <= SQUARE_TOLERANCE ? Math.min(width, height) : -1;
	}

	function uriField(type: string): string | undefined {
		if (type.startsWith('java.') || type.startsWith('android.') || !type.includes('.')) {
			return undefined;
		}

		try {
			return java
				.describe(type)
				.fields?.find((field) => !field.static && field.type === 'android.net.Uri')?.name;
		} catch {
			return undefined;
		}
	}

	function sourcePath(name: string) {
		if (sourcePaths.has(name)) return sourcePaths.get(name)!;

		let found: { holder: string; uri: string } | null = null;

		for (let current: string | null | undefined = name; current && current !== attachClass;) {
			const description = java.describe(current);

			for (const field of description.fields ?? []) {
				const uri = field.static ? undefined : uriField(field.type);

				if (uri) {
					found = { holder: field.name, uri };
					break;
				}
			}

			if (found) break;

			current = description.superclass;
		}

		sourcePaths.set(name, found);

		return found;
	}

	function imageUrl(view: NativeJavaReference): string | undefined {
		const path = sourcePath(javaText(java.className(view)) ?? '');
		const holder = path ? javaReference(java.getField(view, path.holder)) : null;
		const uri = holder && path ? javaReference(java.getField(holder, path.uri)) : null;

		return uri ? javaText(java.invoke(uri, 'toString', [])) : undefined;
	}

	async function adoptBorder(view: NativeJavaReference): Promise<Rounded | null> {
		if (!hasBorderRadius(view)) return null;

		let size = await squareSize(view);

		for (let retry = 0; size === 0 && retry < SIZE_RETRIES; retry++) {
			await new Promise((resolve) => setTimeout(resolve, SIZE_RETRY_MS));
			size = await squareSize(view);
		}

		if (
			size <= 0 ||
			disposed ||
			!(await clipsToCircle(view, size)) ||
			!mayBeAvatar(imageUrl(view))
		) {
			return null;
		}

		const rounded: Rounded = { kind: 'border', view, circle: size / 2 };

		if (isMissing(java.getAssociatedObject(view, roundedBorder))) {
			java.setAssociatedObject(view, roundedBorder, javaBoolean(true));
			track(rounded);
		}

		return rounded;
	}

	function adopt(view: NativeJavaReference): Promise<Rounded | null> {
		if (javaFlag(java.invoke(avatarClass, 'isInstance', [view]))) return adoptOutline(view);

		return adoptBorder(view);
	}

	async function density(view: NativeJavaReference): Promise<number> {
		const resources = javaReference(await onMain(view, 'getResources'));
		const metrics = resources
			? javaReference(java.invoke(resources, 'getDisplayMetrics', []))
			: null;

		return metrics ? (javaNumber(java.getField(metrics, 'density')) ?? 1) : 1;
	}

	async function apply(rounded: Rounded) {
		if (disposed) return;

		const { view } = rounded;
		const corner = radius() * (await density(view));

		if (rounded.kind === 'border') {
			await java.invokeAsync(view, 'setBorderRadius', [javaFloat(corner)]);

			return;
		}

		const background = java.construct('android.graphics.drawable.GradientDrawable', []);

		java.invoke(background, 'setCornerRadius', [javaFloat(corner)]);
		java.invoke(background, 'setColor', [javaInt(0)]);

		await java.invokeAsync(view, 'setBackground', [background]);
		await java.invokeAsync(view, 'setOutlineProvider', [backgroundOutline]);
		await java.invokeAsync(view, 'setClipToOutline', [javaBoolean(true)]);
		await java.invokeAsync(view, 'invalidateOutline', []);
	}

	async function round(view: NativeJavaReference) {
		if (disposed) return;

		const rounded = await adopt(view);

		if (rounded) await apply(rounded);
	}

	async function restore(rounded: Rounded) {
		const { view } = rounded;

		if (rounded.kind === 'border') {
			await java.invokeAsync(view, 'setBorderRadius', [javaFloat(rounded.circle)]);

			return;
		}

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
		if (!isCancellation(error)) {
			console.error(`[${PLUGIN_NAME}] Failed to round an avatar:`, error);
		}
	}

	const token = hooks.hook(
		attachClass,
		'onAttachedToWindow',
		[],
		{ notify: true },
		({ self }) => {
			const view = javaReference(self);

			if (view) round(view).catch(report);
		},
	);

	async function roundAttached() {
		const root = currentDecorView(java);

		if (!root) return;

		for (const view of await findViewsOfClass(java, root, attachClass)) {
			if (!disposed) round(view).catch(report);
		}
	}

	roundAttached().catch(report);

	return {
		rounded: () => tracked.length,
		refresh() {
			for (const rounded of tracked) apply(rounded).catch(report);
		},
		async dispose() {
			disposed = true;
			hooks.remove(token);

			await Promise.all(tracked.splice(0).map((rounded) => restore(rounded).catch(report)));
		},
	};
}

export default { roundAndroidAvatars };
