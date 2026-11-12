import type {
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeJavaReference,
	NativeJavaValue,
	NativeUIScope,
} from '@unbound-app/api/native';
import {
	javaInt,
	javaNumber,
	javaReference,
} from '@unbound-plugins/shared/native/android/java-values';

import { roundMosaicOf } from '~/native/android/worklets';

const STATE_KEY = '__unboundChatBubblesMosaics';
const MOSAIC_LAYOUT =
	'com.discord.chat.presentation.message.view.mosaic_recycler.MosaicLayoutManager';
const LAYOUT_MANAGER = 'androidx.recyclerview.widget.a';
const RECYCLER_VIEW = 'androidx.recyclerview.widget.RecyclerView';
const MAX_TRACKED = 200;

/** The obfuscated names of the mosaic's layout pass, the width it lays its tiles out in, its list, and the width its list is measured to. */
export type MosaicShape = {
	layout: string;
	parameters: string[];
	width: string;
	list: string;
	listWidth: string;
};

type MosaicState = {
	java: NativeJavaBridge;
	shape: MosaicShape;
	/** Discord's own width for each mosaic this side narrowed, by its layout manager's handle. */
	widths: Map<string, { manager: NativeJavaReference; width: number }>;
};

type StateHolder = Record<typeof STATE_KEY, MosaicState | undefined>;

/**
 * @description Finds the mosaic layout manager's layout pass, tile width field and list field by their shape, since Discord obfuscates their names.
 * @param java The plugin's Java bridge.
 * @returns The names, or `undefined` when this build lays media out differently.
 */
export function mosaicShape(java: NativeJavaBridge): MosaicShape | undefined {
	let own: ReturnType<NativeJavaBridge['describe']>;

	try {
		own = java.describe(MOSAIC_LAYOUT);
	} catch {
		// A build without the mosaic lays its media out some other way.
		return;
	}

	const layout = own.methods.find(
		(method) =>
			!method.static && method.returnType === 'void' && method.parameters.length === 2,
	);
	// Discord reads its fixed spacings into the first int fields when built, and sets the width it lays out in, the last, on each bind.
	const width = own.fields.filter((field) => !field.static && field.type === 'int').at(-1);
	const base = java.describe(LAYOUT_MANAGER).fields.filter((field) => !field.static);
	const list = base.find((field) => field.type === RECYCLER_VIEW);
	// A layout manager keeps its list's measured width and height in its last two int fields, set before each layout pass, measuring ones too.
	const listWidth = base.filter((field) => field.type === 'int').at(-2);

	if (!layout || !width || !list || !listWidth) return;

	return {
		layout: layout.name,
		parameters: layout.parameters,
		width: width.name,
		list: list.name,
		listWidth: listWidth.name,
	};
}

function narrow(current: MosaicState, manager: NativeJavaReference, key: string) {
	'worklet';
	const { java, shape } = current;
	const width = javaNumber(java.getField(manager, shape.width)) ?? 0;
	// The list's width as this pass measures it, so the mosaic's height follows its narrower tiles.
	const room =
		(javaNumber(java.getField(manager, shape.listWidth)) ?? 0) -
		(javaNumber(java.invoke(manager, 'getPaddingLeft', [])) ?? 0) -
		(javaNumber(java.invoke(manager, 'getPaddingRight', [])) ?? 0);

	if (room <= 0 || width <= room) return;

	const known = current.widths.get(key);

	// Discord sets its width again on each bind; a width other than the one set here is its own.
	if (!known || known.width !== width) {
		current.widths.delete(key);
		current.widths.set(key, { manager, width });

		if (current.widths.size > MAX_TRACKED) {
			current.widths.delete(current.widths.keys().next().value as string);
		}
	}

	java.setField(manager, shape.width, javaInt(room));
}

/**
 * @description Keeps Discord's media mosaics inside their bubbles, and rounds them as their bubbles ask: right before a mosaic lays its tiles out, narrows the width Discord sized them for to the width the bubble's padding leaves its list.
 * @param scope The plugin's UI scope.
 * @param shape The mosaic layout manager's obfuscated names.
 */
export function installMosaicHook(scope: NativeUIScope, shape: MosaicShape) {
	'worklet';
	const java = scope.java as NativeJavaBridge;
	const hooks = scope.hooks as NativeJavaHooksBridge;
	const current: MosaicState = { java, shape, widths: new Map() };

	(globalThis as unknown as StateHolder)[STATE_KEY] = current;

	hooks.hook(
		MOSAIC_LAYOUT,
		shape.layout,
		shape.parameters,
		{ notify: true },
		(event: { self?: NativeJavaValue }) => {
			const manager = javaReference(event.self);

			if (
				!manager ||
				!('value' in manager) ||
				(globalThis as unknown as StateHolder)[STATE_KEY] !== current
			) {
				return;
			}

			try {
				narrow(current, manager, String(manager.value));

				const list = javaReference(java.getField(manager, shape.list));

				if (list) roundMosaicOf(list);
			} catch (error) {
				console.error(`[Chat Bubbles] ${String(error)}`);
			}
		},
	);
}

/**
 * @description Gives every mosaic narrowed for a bubble Discord's own width back and lays it out again.
 */
export function restoreMosaics() {
	'worklet';
	const holder = globalThis as unknown as StateHolder;
	const current = holder[STATE_KEY];

	if (!current) return;

	const { java, shape } = current;

	holder[STATE_KEY] = undefined;

	for (const { manager, width } of current.widths.values()) {
		try {
			java.setField(manager, shape.width, javaInt(width));

			const list = javaReference(java.getField(manager, shape.list));

			if (list) java.invoke(list, 'requestLayout', []);
		} catch (error) {
			console.error(`[Chat Bubbles] ${String(error)}`);
		}
	}
}

export default { mosaicShape, installMosaicHook, restoreMosaics };
