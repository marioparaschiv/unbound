import type {
	NativeJavaAssociationKey,
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeJavaReference,
	NativeJavaValue,
	NativeUIScope,
} from '@unbound-app/api/native';
import {
	javaBoolean,
	javaFlag,
	javaFloat,
	javaInt,
	javaNumber,
	javaReference,
	javaText,
} from '@unbound-plugins/shared/native/android/java-values';

const PROBE_SIZE = 100;
const MAX_TRACKED = 512;
const STATE_KEY = '__unboundAvatarRadiusAndroid';

type OutlineState = {
	java: NativeJavaBridge;
	radius: number;
	avatarClass: NativeJavaReference;
	backgroundOutline: NativeJavaValue;
	originalOutline: NativeJavaAssociationKey;
	originalBackground: NativeJavaAssociationKey;
	circles: Map<string, boolean>;
	tracked: Map<string, NativeJavaReference>;
};

type StateHolder = Record<typeof STATE_KEY, OutlineState | undefined>;

type AttachEvent = {
	self?: NativeJavaValue;
};

export type OutlineClasses = {
	avatar: string;
	attach: string;
};

function holder(): StateHolder {
	'worklet';

	return globalThis as unknown as StateHolder;
}

function isMissing(value: NativeJavaValue | null | undefined): boolean {
	'worklet';

	return !value || value.type === 'null';
}

function viewKey(view: NativeJavaReference): string {
	'worklet';

	return 'value' in view ? String(view.value) : '';
}

function density(java: NativeJavaBridge, view: NativeJavaReference): number {
	'worklet';
	const resources = javaReference(java.invoke(view, 'getResources', []));
	const metrics = resources
		? javaReference(java.invoke(resources, 'getDisplayMetrics', []))
		: null;

	return metrics ? (javaNumber(java.getField(metrics, 'density')) ?? 1) : 1;
}

function isCircle(
	current: OutlineState,
	provider: NativeJavaReference,
	view: NativeJavaReference,
): boolean {
	'worklet';
	const { java } = current;
	const name = javaText(java.className(provider)) ?? '';
	const known = current.circles.get(name);

	if (known !== undefined) {
		return known;
	}

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

	current.circles.set(name, circle);

	return circle;
}

function adopt(current: OutlineState, view: NativeJavaReference): boolean {
	'worklet';
	const { java } = current;

	if (!isMissing(java.getAssociatedObject(view, current.originalOutline))) {
		return true;
	}

	const provider = javaReference(java.invoke(view, 'getOutlineProvider', []));

	if (!provider || !isCircle(current, provider, view)) {
		return false;
	}

	java.setAssociatedObject(view, current.originalOutline, provider);
	java.setAssociatedObject(
		view,
		current.originalBackground,
		java.invoke(view, 'getBackground', []),
	);

	return true;
}

function apply(current: OutlineState, view: NativeJavaReference) {
	'worklet';
	const { java } = current;
	const background = java.construct('android.graphics.drawable.GradientDrawable', []);

	java.invoke(background, 'setCornerRadius', [javaFloat(current.radius * density(java, view))]);
	java.invoke(background, 'setColor', [javaInt(0)]);
	java.invoke(view, 'setBackground', [background]);
	java.invoke(view, 'setOutlineProvider', [current.backgroundOutline]);
	java.invoke(view, 'setClipToOutline', [javaBoolean(true)]);
	java.invoke(view, 'invalidateOutline', []);
}

function track(current: OutlineState, view: NativeJavaReference) {
	'worklet';
	const key = viewKey(view);

	current.tracked.delete(key);
	current.tracked.set(key, view);

	if (current.tracked.size > MAX_TRACKED) {
		current.tracked.delete(current.tracked.keys().next().value as string);
	}
}

function guarded(action: () => void) {
	'worklet';

	try {
		action();
	} catch (error) {
		console.error(`[Avatar Radius] ${String(error)}`);
	}
}

function roundOutline(current: OutlineState, view: NativeJavaReference) {
	'worklet';

	if (!javaFlag(current.java.invoke(current.avatarClass, 'isInstance', [view]))) {
		return;
	}

	if (adopt(current, view)) {
		track(current, view);
		apply(current, view);
	}
}

/**
 * @description Rounds Discord's native chat avatars from a hook that runs on the UI thread the moment each one attaches, so it is drawn with the chosen corners from its first frame.
 * @param scope The plugin's UI scope.
 * @param classes The avatar class and the class whose `onAttachedToWindow` it inherits.
 * @param radius The chosen radius in density-independent pixels.
 */
export function installOutlineHook(scope: NativeUIScope, classes: OutlineClasses, radius: number) {
	'worklet';
	const java = scope.java as NativeJavaBridge;
	const hooks = scope.hooks as NativeJavaHooksBridge;
	const current: OutlineState = {
		java,
		radius,
		avatarClass: java.getClass(classes.avatar),
		backgroundOutline: java.getField(
			java.getClass('android.view.ViewOutlineProvider'),
			'BACKGROUND',
		),
		originalOutline: java.createAssociationKey(),
		originalBackground: java.createAssociationKey(),
		circles: new Map(),
		tracked: new Map(),
	};

	holder()[STATE_KEY] = current;

	hooks.hook(classes.attach, 'onAttachedToWindow', [], { notify: true }, (event: AttachEvent) => {
		const view = javaReference(event.self);

		if (view) {
			guarded(() => roundOutline(current, view));
		}
	});
}

/**
 * @description Changes the radius and re-rounds the chat avatars the hook has seen.
 * @param radius The chosen radius in density-independent pixels.
 */
export function setOutlineRadius(radius: number) {
	'worklet';
	const current = holder()[STATE_KEY];

	if (!current) {
		return;
	}

	current.radius = radius;

	for (const view of current.tracked.values()) {
		guarded(() => apply(current, view));
	}
}

/**
 * @description Gives every chat avatar the hook rounded back its own outline and background.
 */
export function restoreOutlines() {
	'worklet';
	const current = holder()[STATE_KEY];

	if (!current) {
		return;
	}

	const { java } = current;

	for (const view of current.tracked.values()) {
		guarded(() => {
			const provider = java.getAssociatedObject(view, current.originalOutline);

			if (isMissing(provider)) {
				return;
			}

			const background = java.getAssociatedObject(view, current.originalBackground);

			java.invoke(view, 'setBackground', [
				isMissing(background)
					? { type: 'null', class: 'android.graphics.drawable.Drawable' }
					: background,
			]);
			java.invoke(view, 'setOutlineProvider', [provider]);
			java.invoke(view, 'invalidateOutline', []);
		});
	}

	holder()[STATE_KEY] = undefined;
}

/**
 * @description Counts the chat avatars the hook rounded.
 * @returns The count.
 */
export function countOutlines(): number {
	'worklet';

	return holder()[STATE_KEY]?.tracked.size ?? 0;
}

export default { installOutlineHook, setOutlineRadius, restoreOutlines, countOutlines };
