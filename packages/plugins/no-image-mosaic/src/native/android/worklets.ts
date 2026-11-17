import {
	javaInt,
	javaNumber,
	javaReference,
	javaText,
} from '@unbound-plugins/shared/native/android/java-values';
import { reportWorkletError } from '@unbound-plugins/shared/native/report-worklet-error';
import type {
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeJavaReference,
	NativeJavaValue,
	NativeUIScope,
} from '@unbound-app/api/native';

import { singleSize, stackTiles } from '~/lib/stack';
import { ASPECT_GETTER, MOSAIC_LAYOUT, type MosaicShape } from '~/native/android/mosaic-shape';

const STATE_KEY = '__unboundNoImageMosaic';
const MAX_TRACKED = 200;
const MEASURE_EXACTLY = 0x40000000;
const SIZE_PARAMETERS = ['int', 'int'];

type MosaicState = {
	java: NativeJavaBridge;
	shape: MosaicShape;
	/** Each list this side restacked, by handle, to lay out again as Discord's grid on stop. */
	lists: Map<string, NativeJavaReference>;
};

type StateHolder = Record<typeof STATE_KEY, MosaicState | undefined>;

function holder() {
	'worklet';

	return globalThis as unknown as StateHolder;
}

function track(current: MosaicState, list: NativeJavaReference) {
	'worklet';
	const key = 'value' in list ? String(list.value) : undefined;

	if (!key || current.lists.has(key)) return;

	current.lists.set(key, list);

	if (current.lists.size > MAX_TRACKED) {
		current.lists.delete(current.lists.keys().next().value as string);
	}
}

function exactly(size: number) {
	'worklet';

	return javaInt(MEASURE_EXACTLY | size);
}

function readInt(java: NativeJavaBridge, target: NativeJavaReference, field: string) {
	'worklet';

	return javaNumber(java.getField(target, field)) ?? 0;
}

function aspectOf(java: NativeJavaBridge, tile: NativeJavaReference) {
	'worklet';

	return javaNumber(java.invoke(tile, ASPECT_GETTER, [])) ?? 1;
}

function mosaicManagerOf(current: MosaicState, tile: NativeJavaReference) {
	'worklet';
	const { java, shape } = current;
	const list = javaReference(java.invoke(tile, 'getParent', []));
	const manager = list ? javaReference(java.getField(list, shape.manager)) : null;

	return manager && javaText(java.className(manager)) === MOSAIC_LAYOUT ? manager : null;
}

function sizeTile(current: MosaicState, tile: NativeJavaReference) {
	'worklet';
	const { java, shape } = current;
	const manager = mosaicManagerOf(current, tile);

	if (!manager) return undefined;

	const { width, height } = singleSize(
		aspectOf(java, tile),
		readInt(java, manager, shape.width),
		readInt(java, manager, shape.maxHeight),
	);

	return { arguments: [javaInt(width), javaInt(height)] };
}

function restack(current: MosaicState, manager: NativeJavaReference) {
	'worklet';
	const { java, shape } = current;
	const list = javaReference(java.getField(manager, shape.list));
	const count = list ? (javaNumber(java.invoke(list, 'getChildCount', [])) ?? 0) : 0;

	if (!list || count < 2) return;

	const tiles: NativeJavaReference[] = [];

	for (let index = 0; index < count; index++) {
		const view = javaReference(java.invoke(list, 'getChildAt', [javaInt(index)]));

		// A child that is not one of Discord's tiles keeps the whole grid as Discord laid it out.
		if (!view || !shape.tiles.includes(javaText(java.className(view)) ?? '')) return;

		tiles.push(view);
	}

	const frames = stackTiles(
		tiles.map((tile) => aspectOf(java, tile)),
		readInt(java, manager, shape.width),
		readInt(java, manager, shape.maxHeight),
		readInt(java, manager, shape.spacing),
	);

	tiles.forEach((tile, index) => {
		const { top, width, height } = frames[index]!;

		java.invoke(tile, 'measure', [exactly(width), exactly(height)]);
		java.invoke(tile, 'layout', [
			javaInt(0),
			javaInt(top),
			javaInt(width),
			javaInt(top + height),
		]);
	});

	track(current, list);
}

/**
 * @description Stacks every media mosaic one image per row: sizes each tile as a lone image when Discord sizes it, and
 * moves the tiles under one another right after Discord lays out its grid, so the list measures its height from them.
 * @param scope The plugin's UI scope, which removes the hooks on dispose.
 * @param shape The mosaic's obfuscated names.
 */
export function installMosaicHook(scope: NativeUIScope, shape: MosaicShape) {
	'worklet';
	const java = scope.java as NativeJavaBridge;
	const hooks = scope.hooks as NativeJavaHooksBridge;
	const current: MosaicState = { java, shape, lists: new Map() };

	holder()[STATE_KEY] = current;

	for (const tileClass of shape.tiles) {
		hooks.hook(
			tileClass,
			shape.resize,
			SIZE_PARAMETERS,
			{ rewriteArguments: true, payload: { arguments: [] } },
			(event: { self?: NativeJavaValue }) => {
				const tile = javaReference(event.self);

				if (!tile || holder()[STATE_KEY] !== current) return undefined;

				try {
					return sizeTile(current, tile);
				} catch (error) {
					reportWorkletError('No Image Mosaic', error);

					return undefined;
				}
			},
		);
	}

	hooks.hook(
		MOSAIC_LAYOUT,
		shape.layout,
		shape.parameters,
		{ notify: 'after', payload: { arguments: [] } },
		(event: { self?: NativeJavaValue }) => {
			const manager = javaReference(event.self);

			if (!manager || holder()[STATE_KEY] !== current) return;

			try {
				restack(current, manager);
			} catch (error) {
				reportWorkletError('No Image Mosaic', error);
			}
		},
	);
}

/**
 * @description Stops stacking and lays every stacked mosaic out again as Discord's grid.
 */
export function restoreMosaics() {
	'worklet';
	const current = holder()[STATE_KEY];

	if (!current) return;

	holder()[STATE_KEY] = undefined;

	for (const list of current.lists.values()) {
		try {
			current.java.invoke(list, 'requestLayout', []);
		} catch (error) {
			reportWorkletError('No Image Mosaic', error);
		}
	}
}
