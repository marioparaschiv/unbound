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

type FastImage = { core: NativeObjectHandle; frame: NativeObjectHandle | null; width: number };

function width(objc: NativeObjCBridge, view: NativeObjectHandle): number {
	return readRect(objc.call(view, 'bounds')).width;
}

function layerOf(
	objc: NativeObjCBridge,
	view: NativeObjectHandle | null,
): NativeObjectHandle | null {
	return view ? ((objc.call(view, 'layer') as NativeObjectHandle | null) ?? null) : null;
}

function isCircle(objc: NativeObjCBridge, layer: NativeObjectHandle | null, size: number): boolean {
	return !!layer && Number(objc.call(layer, 'cornerRadius')) >= size * CIRCLE_RATIO;
}

function imageUrl(objc: NativeObjCBridge, core: NativeObjectHandle): string | undefined {
	if (!objc.respondsTo(core, 'sd_imageURL')) return undefined;

	const url = objc.call(core, 'sd_imageURL') as NativeObjectHandle | null;
	const text = url ? objc.call(url, 'absoluteString') : null;

	return typeof text === 'string' ? text : undefined;
}

function round(objc: NativeObjCBridge, avatar: NativeObjectHandle, radius: number): void {
	const { width } = readRect(objc.call(avatar, 'bounds'));
	const layer = objc.call(avatar, 'layer') as NativeObjectHandle | null;

	if (layer) objc.call(layer, 'setCornerRadius:', cornerRadius(radius, width));
}

async function roundVisible(objc: NativeObjCBridge, radius: number): Promise<void> {
	for (const avatar of await findVisibleCells(objc, AvatarClass.ios)) {
		const { width } = readRect(objc.call(avatar, 'bounds'));
		const layer = objc.call(avatar, 'layer') as NativeObjectHandle | null;

		if (layer) await objc.invokeAsync(layer, 'setCornerRadius:', [cornerRadius(radius, width)]);
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

	function adoptFastImage(core: NativeObjectHandle): FastImage | null {
		const { width: size, height } = readRect(objc.call(core, 'bounds'));

		if (size <= 0 || Math.abs(size - height) > SQUARE_TOLERANCE) return null;

		const frame = (objc.call(core, 'superview') as NativeObjectHandle | null) ?? null;
		const frameLayer =
			frame && Math.abs(width(objc, frame) - size) <= SQUARE_TOLERANCE
				? layerOf(objc, frame)
				: null;
		const circle =
			isCircle(objc, layerOf(objc, core), size) || isCircle(objc, frameLayer, size);

		if (!circle || !mayBeAvatar(imageUrl(objc, core))) return null;

		return { core, frame: frameLayer ? frame : null, width: size };
	}

	function applyFastImage(image: FastImage, corner: number, call = objc.call.bind(objc)) {
		for (const view of [image.core, image.frame]) {
			const layer = layerOf(objc, view);

			if (layer) call(layer, 'setCornerRadius:', corner);
		}
	}

	function roundFastImage(core: NativeObjectHandle) {
		const image = adoptFastImage(core);
		const key = image && viewKey(objc, core);

		if (!image || !key) return;

		track(key, image);
		applyFastImage(image, cornerRadius(radius(), image.width));
	}

	async function eachFastImage(corner: (image: FastImage) => number) {
		await Promise.all(
			[...fastImages.values()].flatMap((image) =>
				[image.core, image.frame].flatMap((view) => {
					const layer = layerOf(objc, view);

					return layer
						? [
								objc
									.invokeAsync(layer, 'setCornerRadius:', [corner(image)])
									.catch(() => undefined),
							]
						: [];
				}),
			),
		);
	}

	const hooks = [
		objc.hook(AvatarClass.ios, 'layoutSubviews', {
			after: ({ self }) => round(objc, self, radius()),
		}),
		objc.hook(AvatarClass.iosImage, 'layoutSubviews', {
			after: ({ self }) => roundFastImage(self),
		}),
	];

	const refresh = () => {
		void roundVisible(objc, radius());
		void eachFastImage((image) => cornerRadius(radius(), image.width));
	};

	void roundVisible(objc, radius());
	void findVisibleCells(objc, AvatarClass.iosImage, undefined, IMAGE_SEARCH).then((cores) => {
		for (const core of cores) {
			const image = adoptFastImage(core);
			const key = image && viewKey(objc, core);

			if (!image || !key) continue;

			track(key, image);
			applyFastImage(image, cornerRadius(radius(), image.width), (layer, selector, value) =>
				objc.invokeAsync(layer, selector, [value]),
			);
		}
	});

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
