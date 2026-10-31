import type { NativeObjCBridge, NativeObjectHandle, NativeUIScope } from '@unbound-app/api/native';

import { AvatarClass } from '~/constants';

const CIRCLE_RATIO = 0.44;
const SQUARE_TOLERANCE = 1;
const MAX_TRACKED = 512;
const STATE_KEY = '__unboundAvatarRadius';
const NON_AVATAR_PATHS = [
	'/icons/',
	'/app-icons/',
	'/role-icons/',
	'/clan-badges/',
	'/badge-icons/',
	'/emojis/',
	'/stickers/',
	'/splashes/',
	'/banners/',
];

type Clip = {
	view: NativeObjectHandle;
	mask: NativeObjectHandle | null;
};

type TrackedImage = {
	view: NativeObjectHandle;
	width: number;
	layers: NativeObjectHandle[];
	clip?: Clip;
};

type TrackedAvatar = {
	view: NativeObjectHandle;
	inner: Map<string, number>;
};

type AvatarState = {
	objc: NativeObjCBridge;
	radius: number;
	images: Map<string, TrackedImage>;
	avatars: Map<string, TrackedAvatar>;
};

type StateHolder = Record<typeof STATE_KEY, AvatarState | undefined>;

type BoxedRect = {
	value?: BoxedRect;
	size?: BoxedRect;
	width?: number;
	height?: number;
};

export type AvatarCounts = {
	rounded: number;
	unrounded: number;
};

function holder(): StateHolder {
	'worklet';

	return globalThis as unknown as StateHolder;
}

function state(): AvatarState | undefined {
	'worklet';

	return holder()[STATE_KEY];
}

function sizeOf(
	objc: NativeObjCBridge,
	view: NativeObjectHandle,
): { width: number; height: number } {
	'worklet';
	const raw = objc.invoke(view, 'bounds', []) as BoxedRect | null;
	const rect = raw?.value ?? raw;
	const size = rect?.size ?? rect;

	return { width: Number(size?.width ?? 0), height: Number(size?.height ?? 0) };
}

function layerOf(
	objc: NativeObjCBridge,
	view: NativeObjectHandle | null,
): NativeObjectHandle | null {
	'worklet';

	return view ? ((objc.invoke(view, 'layer', []) as NativeObjectHandle | null) ?? null) : null;
}

function keyOf(objc: NativeObjCBridge, view: NativeObjectHandle): string {
	'worklet';

	return String(objc.call(view, 'hash'));
}

function cornerFor(radius: number, width: number): number {
	'worklet';

	return width > 0 ? Math.min(radius, width / 2) : radius;
}

function remember<T>(map: Map<string, T>, key: string, value: T) {
	'worklet';
	map.delete(key);
	map.set(key, value);

	if (map.size > MAX_TRACKED) {
		map.delete(map.keys().next().value as string);
	}
}

function isAvatarUrl(url: string | undefined): boolean {
	'worklet';

	if (!url) {
		return true;
	}

	const path = url.replace(/^[a-z]+:\/\/[^/]+/i, '').split(/[?#]/)[0] ?? '';

	return !NON_AVATAR_PATHS.some((segment) => path.includes(segment));
}

function imageUrl(objc: NativeObjCBridge, core: NativeObjectHandle): string | undefined {
	'worklet';

	if (!objc.respondsTo(core, 'sd_imageURL')) {
		return undefined;
	}

	const url = objc.invoke(core, 'sd_imageURL', []) as NativeObjectHandle | null;
	const text = url ? objc.call(url, 'absoluteString') : null;

	return typeof text === 'string' ? text : undefined;
}

function isCircle(objc: NativeObjCBridge, layer: NativeObjectHandle | null, size: number): boolean {
	'worklet';

	return !!layer && Number(objc.invoke(layer, 'cornerRadius', [])) >= size * CIRCLE_RATIO;
}

function innerClips(
	objc: NativeObjCBridge,
	avatar: NativeObjectHandle,
	width: number,
): NativeObjectHandle[] {
	'worklet';
	const subviews = objc.invoke(avatar, 'subviews', []) as NativeObjectHandle[] | null;
	const clips: NativeObjectHandle[] = [];

	for (const view of Array.isArray(subviews) ? subviews : []) {
		const layer = layerOf(objc, view);

		if (
			layer &&
			objc.invoke(layer, 'masksToBounds', []) &&
			Math.abs(sizeOf(objc, view).width - width) <= SQUARE_TOLERANCE
		) {
			clips.push(view);
		}
	}

	return clips;
}

function roundAvatar(current: AvatarState, avatar: NativeObjectHandle) {
	'worklet';
	const { objc } = current;
	const { width } = sizeOf(objc, avatar);
	const key = keyOf(objc, avatar);
	const tracked = current.avatars.get(key) ?? { view: avatar, inner: new Map<string, number>() };
	const corner = cornerFor(current.radius, width);
	const layer = layerOf(objc, avatar);

	if (layer) {
		objc.invoke(layer, 'setCornerRadius:', [corner]);
	}

	for (const inner of innerClips(objc, avatar, width)) {
		const innerLayer = layerOf(objc, inner);

		if (!innerLayer) {
			continue;
		}

		const innerKey = keyOf(objc, inner);

		if (!tracked.inner.has(innerKey)) {
			tracked.inner.set(innerKey, Number(objc.invoke(innerLayer, 'cornerRadius', [])));
		}

		objc.invoke(innerLayer, 'setCornerRadius:', [corner]);
	}

	remember(current.avatars, key, tracked);
}

function circleClip(objc: NativeObjCBridge, frame: NativeObjectHandle | null): Clip | undefined {
	'worklet';
	const clipClass = objc.getClass(AvatarClass.iosClip);
	const view = frame ? (objc.invoke(frame, 'superview', []) as NativeObjectHandle | null) : null;

	if (!clipClass || !view || !objc.call(view, 'isKindOfClass:', clipClass)) {
		return undefined;
	}

	const layer = layerOf(objc, view);

	if (!layer) {
		return undefined;
	}

	return { view, mask: (objc.invoke(layer, 'mask', []) as NativeObjectHandle | null) ?? null };
}

function adoptImage(objc: NativeObjCBridge, core: NativeObjectHandle): TrackedImage | null {
	'worklet';
	const { width, height } = sizeOf(objc, core);

	if (width <= 0 || Math.abs(width - height) > SQUARE_TOLERANCE) {
		return null;
	}

	const frame = (objc.invoke(core, 'superview', []) as NativeObjectHandle | null) ?? null;
	const frameLayer =
		frame && Math.abs(sizeOf(objc, frame).width - width) <= SQUARE_TOLERANCE
			? layerOf(objc, frame)
			: null;
	const coreLayer = layerOf(objc, core);
	const circle = isCircle(objc, coreLayer, width) || isCircle(objc, frameLayer, width);

	if (!circle || !isAvatarUrl(imageUrl(objc, core))) {
		return null;
	}

	const layers = [coreLayer, frameLayer].filter((layer): layer is NativeObjectHandle => !!layer);
	const clip = circleClip(objc, frame);

	return clip ? { view: core, width, layers, clip } : { view: core, width, layers };
}

function applyImage(objc: NativeObjCBridge, image: TrackedImage, corner: number) {
	'worklet';

	for (const layer of image.layers) {
		objc.invoke(layer, 'setCornerRadius:', [corner]);
	}

	const clipLayer = image.clip ? layerOf(objc, image.clip.view) : null;

	if (clipLayer) {
		objc.invoke(clipLayer, 'setMask:', [null]);
	}
}

function roundImage(current: AvatarState, core: NativeObjectHandle) {
	'worklet';
	const { objc } = current;
	const key = keyOf(objc, core);
	const known = current.images.get(key);
	const image =
		known && Math.abs(sizeOf(objc, core).width - known.width) <= SQUARE_TOLERANCE
			? known
			: adoptImage(objc, core);

	if (!image) {
		return;
	}

	remember(current.images, key, image);
	applyImage(objc, image, cornerFor(current.radius, image.width));
}

function unmaskClip(current: AvatarState, clip: NativeObjectHandle) {
	'worklet';
	const key = keyOf(current.objc, clip);

	for (const image of current.images.values()) {
		if (image.clip && keyOf(current.objc, image.clip.view) === key) {
			const layer = layerOf(current.objc, image.clip.view);

			if (layer) {
				current.objc.invoke(layer, 'setMask:', [null]);
			}

			return;
		}
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

/**
 * @description Installs the avatar hooks in the UI runtime, where they round each avatar as Discord lays it out, before the frame is drawn.
 * @param scope The plugin's UI scope.
 * @param radius The chosen radius in points.
 */
export function installAvatarHooks(scope: NativeUIScope, radius: number) {
	'worklet';
	const objc = scope.objc as NativeObjCBridge;
	const current: AvatarState = { objc, radius, images: new Map(), avatars: new Map() };

	holder()[STATE_KEY] = current;

	objc.hook(AvatarClass.ios, 'layoutSubviews', {
		after: ({ self }) => guarded(() => roundAvatar(current, self)),
	});
	objc.hook(AvatarClass.iosImage, 'layoutSubviews', {
		after: ({ self }) => guarded(() => roundImage(current, self)),
	});

	if (objc.getClass(AvatarClass.iosClip)) {
		objc.hook(AvatarClass.iosClip, 'layoutSubviews', {
			after: ({ self }) => guarded(() => unmaskClip(current, self)),
		});
	}
}

/**
 * @description Changes the radius and re-rounds every avatar the hooks have seen.
 * @param radius The chosen radius in points.
 */
export function setAvatarRadius(radius: number) {
	'worklet';
	const current = state();

	if (!current) {
		return;
	}

	current.radius = radius;

	for (const tracked of current.avatars.values()) {
		guarded(() => roundAvatar(current, tracked.view));
	}

	for (const image of current.images.values()) {
		guarded(() => applyImage(current.objc, image, cornerFor(radius, image.width)));
	}
}

/**
 * @description Brings back the circles on every avatar the hooks rounded and forgets them.
 */
export function restoreAvatars() {
	'worklet';
	const current = state();

	if (!current) {
		return;
	}

	const { objc } = current;

	for (const tracked of current.avatars.values()) {
		guarded(() => {
			const { width } = sizeOf(objc, tracked.view);
			const layer = layerOf(objc, tracked.view);

			if (layer) {
				objc.invoke(layer, 'setCornerRadius:', [width / 2]);
			}

			for (const inner of innerClips(objc, tracked.view, width)) {
				const original = tracked.inner.get(keyOf(objc, inner));
				const innerLayer = layerOf(objc, inner);

				if (innerLayer && original !== undefined) {
					objc.invoke(innerLayer, 'setCornerRadius:', [original]);
				}
			}
		});
	}

	for (const image of current.images.values()) {
		guarded(() => {
			for (const layer of image.layers) {
				objc.invoke(layer, 'setCornerRadius:', [image.width / 2]);
			}

			const clipLayer = image.clip ? layerOf(objc, image.clip.view) : null;

			if (clipLayer && image.clip) {
				objc.invoke(clipLayer, 'setMask:', [image.clip.mask]);
			}
		});
	}

	holder()[STATE_KEY] = undefined;
}

/**
 * @description Counts the avatars the hooks rounded and those on screen that lost their corners.
 * @returns The counts.
 */
export function countAvatars(): AvatarCounts {
	'worklet';
	const current = state();

	if (!current) {
		return { rounded: 0, unrounded: 0 };
	}

	const { objc } = current;
	let unrounded = 0;

	for (const image of current.images.values()) {
		if (!objc.invoke(image.view, 'window', [])) {
			continue;
		}

		const expected = cornerFor(current.radius, image.width);
		const wrong = image.layers.some(
			(layer) =>
				Math.abs(Number(objc.invoke(layer, 'cornerRadius', [])) - expected) >
				SQUARE_TOLERANCE,
		);

		if (wrong) {
			unrounded++;
		}
	}

	return { rounded: current.images.size + current.avatars.size, unrounded };
}

export default { installAvatarHooks, setAvatarRadius, restoreAvatars, countAvatars };
