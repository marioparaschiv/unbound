import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';
import { findVisibleCells } from '@unbound-plugins/shared/native/visible-cells';
import { viewKey } from '@unbound-plugins/shared/native/view-key';
import { readRect } from '@unbound-plugins/shared/native/rect';

import { AvatarClass } from '~/constants';
import { mayBeAvatar } from '~/image-sources';
import { cornerRadius } from '~/radius';

const CIRCLE_RATIO = 0.44;
const SQUARE_TOLERANCE = 1;
const MAX_TRACKED = 512;
const IMAGE_SEARCH = { maxDepth: 96, maxVisited: 8_000 };

type FastImage = { width: number; layers: NativeObjectHandle[] };

async function boundsOf(objc: NativeObjCBridge, view: NativeObjectHandle) {
	return readRect(await objc.invokeAsync(view, 'bounds', []));
}

async function layerOf(
	objc: NativeObjCBridge,
	view: NativeObjectHandle | null,
): Promise<NativeObjectHandle | null> {
	return view
		? (((await objc.invokeAsync(view, 'layer', [])) as NativeObjectHandle | null) ?? null)
		: null;
}

async function cornerOf(objc: NativeObjCBridge, layer: NativeObjectHandle): Promise<number> {
	return Number(await objc.invokeAsync(layer, 'cornerRadius', []));
}

async function isCircle(
	objc: NativeObjCBridge,
	layer: NativeObjectHandle | null,
	size: number,
): Promise<boolean> {
	return !!layer && (await cornerOf(objc, layer)) >= size * CIRCLE_RATIO;
}

async function imageUrl(
	objc: NativeObjCBridge,
	core: NativeObjectHandle,
): Promise<string | undefined> {
	if (!objc.respondsTo(core, 'sd_imageURL')) return undefined;

	const url = (await objc.invokeAsync(core, 'sd_imageURL', [])) as NativeObjectHandle | null;
	const text = url ? objc.call(url, 'absoluteString') : null;

	return typeof text === 'string' ? text : undefined;
}

async function round(
	objc: NativeObjCBridge,
	avatar: NativeObjectHandle,
	radius: number,
): Promise<void> {
	const { width } = await boundsOf(objc, avatar);
	const layer = await layerOf(objc, avatar);

	if (layer) await objc.invokeAsync(layer, 'setCornerRadius:', [cornerRadius(radius, width)]);
}

async function roundVisible(objc: NativeObjCBridge, radius: number): Promise<void> {
	for (const avatar of await findVisibleCells(objc, AvatarClass.ios)) {
		await round(objc, avatar, radius);
	}
}

/**
 * @description Rounds every `DCDAvatarView` to the chosen radius each time Discord lays it out, and the circular `DCDFastImage` avatars React Native draws in member lists, DMs and profiles.
 * @param objc The Objective-C bridge.
 * @param radius Reads the chosen radius.
 * @returns `refresh`, which re-rounds the avatars on screen, and `dispose`, which brings back the circles.
 */
export function roundIOSAvatars(objc: NativeObjCBridge, radius: () => number) {
	const fastImages = new Map<string, FastImage>();

	function track(key: string, image: FastImage) {
		fastImages.delete(key);
		fastImages.set(key, image);

		if (fastImages.size > MAX_TRACKED) fastImages.delete(fastImages.keys().next().value!);
	}

	async function adoptFastImage(core: NativeObjectHandle): Promise<FastImage | null> {
		const { width: size, height } = await boundsOf(objc, core);

		if (size <= 0 || Math.abs(size - height) > SQUARE_TOLERANCE) return null;

		const frame =
			((await objc.invokeAsync(core, 'superview', [])) as NativeObjectHandle | null) ?? null;
		const frameLayer =
			frame && Math.abs((await boundsOf(objc, frame)).width - size) <= SQUARE_TOLERANCE
				? await layerOf(objc, frame)
				: null;
		const coreLayer = await layerOf(objc, core);
		const circle =
			(await isCircle(objc, coreLayer, size)) || (await isCircle(objc, frameLayer, size));

		if (!circle || !mayBeAvatar(await imageUrl(objc, core))) return null;

		const layers = [coreLayer, frameLayer].filter(
			(layer): layer is NativeObjectHandle => !!layer,
		);

		return { width: size, layers };
	}

	async function applyFastImage(image: FastImage, corner: (image: FastImage) => number) {
		await Promise.all(
			image.layers.map((layer) =>
				objc.invokeAsync(layer, 'setCornerRadius:', [corner(image)]).catch(() => undefined),
			),
		);
	}

	const corner = (image: FastImage) => cornerRadius(radius(), image.width);

	async function roundFastImage(core: NativeObjectHandle) {
		const key = viewKey(objc, core);
		const known = key ? fastImages.get(key) : undefined;

		if (known) {
			const { width } = await boundsOf(objc, core);

			if (Math.abs(width - known.width) <= SQUARE_TOLERANCE) {
				await applyFastImage(known, corner);

				return;
			}
		}

		const image = await adoptFastImage(core);

		if (!image || !key) return;

		track(key, image);
		await applyFastImage(image, corner);
	}

	async function eachFastImage(cornerFor: (image: FastImage) => number) {
		await Promise.all(
			[...fastImages.values()].map((image) => applyFastImage(image, cornerFor)),
		);
	}

	const hooks = [
		objc.hook(AvatarClass.ios, 'layoutSubviews', {
			after: ({ self }) => void round(objc, self, radius()).catch(() => undefined),
		}),
		objc.hook(AvatarClass.iosImage, 'layoutSubviews', {
			after: ({ self }) => void roundFastImage(self).catch(() => undefined),
		}),
	];

	const refresh = () => {
		void roundVisible(objc, radius());
		void eachFastImage(corner);
	};

	void roundVisible(objc, radius());
	void findVisibleCells(objc, AvatarClass.iosImage, undefined, IMAGE_SEARCH).then(
		async (cores) => {
			for (const core of cores) await roundFastImage(core).catch(() => undefined);
		},
	);

	return {
		rounded: () => fastImages.size,
		refresh,
		async dispose() {
			for (const hook of hooks) hook.remove();

			await Promise.all([
				roundVisible(objc, Number.POSITIVE_INFINITY),
				eachFastImage((image) => image.width / 2),
			]);
			fastImages.clear();
		},
	};
}

export default { roundIOSAvatars };
