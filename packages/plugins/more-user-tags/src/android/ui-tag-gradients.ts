import type {
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeJavaReference,
	NativeJavaValue,
	NativeUIScope,
} from '@unbound-app/api/native';
import {
	javaFloat,
	javaInt,
	javaNumber,
	javaReference,
	javaText,
} from '@unbound-plugins/shared/native/android/java-values';

import type { TagAppearanceTable } from '~/ios/ui-tag-gradients';

const STATE_KEY = '__unboundMoreUserTagsAndroid';
const TAG_VIEW = 'com.discord.chat.presentation.message.MessageTagView';
const GRADIENT = 'android.graphics.drawable.GradientDrawable';
const ORIENTATION = 'android.graphics.drawable.GradientDrawable$Orientation';
const PAINT_DRAWABLE = 'android.graphics.drawable.PaintDrawable';
const HEX = /^#[\da-f]{6}$/i;
const MAX_PAINTED = 256;

export type TagBind = {
	name: string;
	parameters: string[];
};

type Painted = {
	layout: NativeJavaReference;
	original: NativeJavaReference;
	gradient: NativeJavaReference;
};

type TagState = {
	java: NativeJavaBridge;
	appearances: TagAppearanceTable;
	leftToRight: NativeJavaReference;
	reflectArray: NativeJavaReference | null;
	painted: Map<string, Painted>;
};

type StateHolder = Record<typeof STATE_KEY, TagState | undefined>;

type BindEvent = {
	self?: NativeJavaValue;
	args?: NativeJavaValue[];
};

function holder(): StateHolder {
	'worklet';

	return globalThis as unknown as StateHolder;
}

function viewKey(view: NativeJavaReference): string {
	'worklet';

	return 'value' in view ? String(view.value) : '';
}

function gradientKey(label: string, color: string): string {
	'worklet';

	return `${label.trim().toLowerCase()}:${color.toLowerCase()}`;
}

function hexOf(color: number): string {
	'worklet';

	return `#${((color >>> 0) & 0xffffff).toString(16).padStart(6, '0')}`;
}

function argbOf(hex: string): number {
	'worklet';

	return 0xff000000 | Number.parseInt(hex.slice(1, 7), 16) | 0;
}

function className(java: NativeJavaBridge, value: NativeJavaReference): string | undefined {
	'worklet';
	const type = javaReference(java.invoke(value, 'getClass', []));

	return type ? javaText(java.invoke(type, 'getName', [])) : undefined;
}

function cornerRadius(current: TagState, drawable: NativeJavaReference): number {
	'worklet';
	const { java } = current;
	const shape = javaReference(java.invoke(drawable, 'getShape', []));
	const radii = shape ? javaReference(java.getField(shape, 'mOuterRadii')) : null;

	if (!radii || !current.reflectArray) {
		return 0;
	}

	return javaNumber(java.invoke(current.reflectArray, 'getFloat', [radii, javaInt(0)])) ?? 0;
}

function findColors(current: TagState, label: string, color: string | null): string[] {
	'worklet';
	const { appearances } = current;
	const direct = color ? appearances[gradientKey(label, color)] : undefined;

	if (direct) {
		return direct.colors;
	}

	const prefix = gradientKey(label, '');
	let found: string[] | null = null;

	for (const key of Object.keys(appearances)) {
		const appearance = appearances[key];

		if (!key.startsWith(prefix) || !appearance) {
			continue;
		}

		if (found && found.join(':') !== appearance.colors.join(':')) {
			return [];
		}

		found = appearance.colors;
	}

	return found ?? [];
}

function remember(current: TagState, key: string, painted: Painted) {
	'worklet';
	current.painted.delete(key);
	current.painted.set(key, painted);

	if (current.painted.size > MAX_PAINTED) {
		current.painted.delete(current.painted.keys().next().value as string);
	}
}

function paint(current: TagState, tagView: NativeJavaReference, text: string) {
	'worklet';
	const { java } = current;
	const layout = javaReference(java.invoke(tagView, 'getChildAt', [javaInt(0)]));
	const background = layout ? javaReference(java.invoke(layout, 'getBackground', [])) : null;

	if (!layout || !background || className(java, background) !== PAINT_DRAWABLE) {
		return;
	}

	const paintHandle = javaReference(java.invoke(background, 'getPaint', []));
	const color = paintHandle ? javaNumber(java.invoke(paintHandle, 'getColor', [])) : undefined;
	const colors = findColors(current, text, color === undefined ? null : hexOf(color)).filter(
		(value) => HEX.test(value),
	);

	if (colors.length < 2) {
		return;
	}

	const gradient = java.construct(GRADIENT, [
		current.leftToRight,
		{ type: 'array', componentType: 'int', value: colors.map(argbOf) },
	]);

	java.invoke(gradient, 'setCornerRadius', [javaFloat(cornerRadius(current, background))]);
	java.invoke(layout, 'setBackground', [gradient]);
	remember(current, viewKey(tagView), { layout, original: background, gradient });
}

/**
 * @description Paints role gradients behind Discord's native Android message tags from a hook that runs on the UI thread right after Discord binds each tag, so a tag is never drawn with its flat color first.
 * @param scope The plugin's UI scope.
 * @param bind The tag view's bind method.
 * @param appearances The gradients per label and color.
 * @returns Whether the gradient classes were found.
 */
export function installAndroidTagGradients(
	scope: NativeUIScope,
	bind: TagBind,
	appearances: TagAppearanceTable,
): boolean {
	'worklet';
	const java = scope.java as NativeJavaBridge;
	const hooks = scope.hooks as NativeJavaHooksBridge;
	const orientation = java.getClass(ORIENTATION);
	const leftToRight = orientation
		? javaReference(java.getField(orientation, 'LEFT_RIGHT'))
		: null;

	if (!leftToRight) {
		return false;
	}

	const current: TagState = {
		java,
		appearances,
		leftToRight,
		reflectArray: java.getClass('java.lang.reflect.Array'),
		painted: new Map(),
	};

	holder()[STATE_KEY] = current;

	hooks.hook(TAG_VIEW, bind.name, bind.parameters, { notify: 'after' }, (event: BindEvent) => {
		const tagView = javaReference(event.self);
		const text = event.args ? javaText(event.args[0]) : undefined;

		if (!tagView || !text || !Object.keys(current.appearances).length) {
			return;
		}

		try {
			paint(current, tagView, text);
		} catch (error) {
			console.error(`[More User Tags] ${String(error)}`);
		}
	});

	return true;
}

/**
 * @description Replaces the gradients the tags are painted with.
 * @param appearances The gradients per label and color.
 */
export function setAndroidTagAppearances(appearances: TagAppearanceTable) {
	'worklet';
	const current = holder()[STATE_KEY];

	if (current) {
		current.appearances = appearances;
	}
}

/**
 * @description Gives every tag it painted its own background back.
 */
export function removeAndroidTagGradients() {
	'worklet';
	const current = holder()[STATE_KEY];

	if (!current) {
		return;
	}

	const { java } = current;

	current.painted.forEach((entry) => {
		try {
			const background = javaReference(java.invoke(entry.layout, 'getBackground', []));

			if (
				background &&
				javaText(java.invoke(background, 'toString', [])) ===
					javaText(java.invoke(entry.gradient, 'toString', []))
			) {
				java.invoke(entry.layout, 'setBackground', [entry.original]);
			}
		} catch (error) {
			console.error(`[More User Tags] ${String(error)}`);
		}
	});

	holder()[STATE_KEY] = undefined;
}

export default { installAndroidTagGradients, setAndroidTagAppearances, removeAndroidTagGradients };
