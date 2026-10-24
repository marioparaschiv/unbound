import type {
	RoleColorAppearance,
	RoleColorStyle,
} from '@unbound-plugins/shared/colors/role-colors';
import type {
	NativeClassHandle,
	NativeObjCBridge,
	NativeObjectHandle,
	NativeStruct,
} from '@unbound-app/api/native';
import { safeInvokeAsync } from '@unbound-plugins/shared/native/safe-invoke';

import type { NativeColors } from '~/native/colors';
import { HEX_COLOR } from '~/constants';

type Rect = { origin: { x: number; y: number }; size: { width: number; height: number } };

/** The last frame and corner radius pushed to a layer, so unchanged layouts cost no native calls. */
type Geometry = { frameSignature: string; cornerRadius: number | null };

/** A gradient layer drawn behind one tag label. */
export type TagLayer = {
	id: string;
	label: NativeObjectHandle;
	layer: NativeObjectHandle;
	labelName: string;
	primaryColor: string;
	colors: string[];
	style: RoleColorStyle;
	originalBackground: NativeObjectHandle | null;
	originalOpaque: boolean;
	geometry: Geometry;
	sheen: (Geometry & { layer: NativeObjectHandle }) | null;
};

export type PainterClasses = {
	CAGradientLayer: NativeClassHandle;
	CABasicAnimation: NativeClassHandle | null;
	CAMediaTimingFunction: NativeClassHandle | null;
	UIAccessibility: NativeClassHandle | null;
};

export type GradientPainter = ReturnType<typeof createGradientPainter>;

function rectSignature(rect: NativeStruct<Rect> | null): string | null {
	const value = rect?.value;

	if (!value) return null;

	const coordinates = [value.origin.x, value.origin.y, value.size.width, value.size.height];

	return coordinates.every(Number.isFinite) ? coordinates.join(':') : null;
}

/**
 * @description Draws role-color gradients, and the animated holographic sheen, into tag layers.
 * @param objc The Objective-C bridge.
 * @param classes The Core Animation and UIKit classes the painter uses.
 * @param colors The renderer's UIKit color helpers.
 * @returns `createLayer` makes a gradient layer, `paint` applies an appearance to it, `removeSheen` drops its sheen.
 */
export function createGradientPainter(
	objc: NativeObjCBridge,
	classes: PainterClasses,
	colors: NativeColors,
) {
	const { CAGradientLayer, CABasicAnimation, CAMediaTimingFunction, UIAccessibility } = classes;
	const reduceMotion = UIAccessibility
		? objc
				.invokeAsync(UIAccessibility, 'isReduceMotionEnabled', [])
				.then(Boolean)
				.catch(() => false)
		: Promise.resolve(false);

	async function pointHorizontally(layer: NativeObjectHandle) {
		await objc.invokeAsync(layer, 'setStartPoint:', [objc.struct('CGPoint', { x: 0, y: 0 })]);
		await objc.invokeAsync(layer, 'setEndPoint:', [objc.struct('CGPoint', { x: 1, y: 0 })]);
	}

	async function fitLayer(
		layer: NativeObjectHandle,
		geometry: Geometry,
		frame: NativeStruct<Rect> | null,
		radius: number,
	) {
		const signature = rectSignature(frame);

		if (signature && signature !== geometry.frameSignature) {
			await objc.invokeAsync(layer, 'setFrame:', [frame]);
			geometry.frameSignature = signature;
		}

		if (Number.isFinite(radius) && radius !== geometry.cornerRadius) {
			await objc.invokeAsync(layer, 'setCornerRadius:', [radius]);
			geometry.cornerRadius = radius;
		}
	}

	async function fit(record: TagLayer) {
		const labelLayer = (await objc.invokeAsync(
			record.label,
			'layer',
			[],
		)) as NativeObjectHandle;
		const frame = (await objc.invokeAsync(record.label, 'frame', [])) as NativeStruct<Rect>;
		const radius = Number(await objc.invokeAsync(labelLayer, 'cornerRadius', []));

		await fitLayer(record.layer, record.geometry, frame, radius);

		if (!record.sheen) return;

		const bounds = (await objc.invokeAsync(record.layer, 'bounds', [])) as NativeStruct<Rect>;

		await fitLayer(record.sheen.layer, record.sheen, bounds, radius);
	}

	async function animateSheen(sheen: NativeObjectHandle, CABasicAnimation: NativeClassHandle) {
		const animation = (await objc.invokeAsync(CABasicAnimation, 'animationWithKeyPath:', [
			'locations',
		])) as NativeObjectHandle | null;

		if (!animation) return;

		await objc.invokeAsync(animation, 'setFromValue:', [[0, 0.1, 0.2, 0.3, 0.4]]);
		await objc.invokeAsync(animation, 'setToValue:', [[0.6, 0.7, 0.8, 0.9, 1]]);
		await objc.invokeAsync(animation, 'setDuration:', [3.2]);
		await objc.invokeAsync(animation, 'setAutoreverses:', [true]);
		await objc.invokeAsync(animation, 'setRepeatCount:', [100000]);
		await objc.invokeAsync(animation, 'setRemovedOnCompletion:', [false]);

		if (CAMediaTimingFunction) {
			const timing = (await objc.invokeAsync(CAMediaTimingFunction, 'functionWithName:', [
				'easeInEaseOut',
			])) as NativeObjectHandle | null;

			if (timing) await objc.invokeAsync(animation, 'setTimingFunction:', [timing]);
		}

		await objc.invokeAsync(sheen, 'addAnimation:forKey:', [
			animation,
			'more-user-tags.holographic-sheen',
		]);
	}

	async function createLayer() {
		return (await objc.invokeAsync(CAGradientLayer, 'layer', [])) as NativeObjectHandle | null;
	}

	async function createSheen(parent: NativeObjectHandle): Promise<NativeObjectHandle | null> {
		if (!CABasicAnimation || (await reduceMotion)) return null;

		let sheen: NativeObjectHandle | null = null;

		try {
			sheen = await createLayer();

			if (!sheen) return null;

			const stops = await Promise.all([
				colors.cgColor('#ffffff', 0),
				colors.cgColor('#ffffff', 0.26),
				colors.cgColor('#d8f4ff', 0.34),
				colors.cgColor('#ffffff', 0.26),
				colors.cgColor('#ffffff', 0),
			]);

			if (stops.some((stop) => !stop)) return null;

			await objc.invokeAsync(sheen, 'setColors:', [stops]);
			await objc.invokeAsync(sheen, 'setLocations:', [[0, 0.1, 0.2, 0.3, 0.4]]);
			await pointHorizontally(sheen);
			await objc.invokeAsync(sheen, 'setMasksToBounds:', [true]);
			await objc.invokeAsync(sheen, 'setZPosition:', [1]);
			await objc.invokeAsync(parent, 'addSublayer:', [sheen]);
			await animateSheen(sheen, CABasicAnimation);

			return sheen;
		} catch {
			const failed = sheen;

			if (failed) await safeInvokeAsync(objc, failed, 'removeFromSuperlayer');

			return null;
		}
	}

	async function removeSheen(record: TagLayer) {
		if (!record.sheen) return;

		const { layer } = record.sheen;

		await safeInvokeAsync(objc, layer, 'removeFromSuperlayer');
		record.sheen = null;
	}

	async function paint(record: TagLayer, appearance: RoleColorAppearance): Promise<boolean> {
		const { colors: stops, style } = appearance;

		if (!stops.length || stops.some((color) => !HEX_COLOR.test(color))) return false;

		try {
			const background = (await objc.invokeAsync(
				record.label,
				'backgroundColor',
				[],
			)) as NativeObjectHandle | null;

			// Discord repaints the label's own background; keep it clear so the gradient shows through.
			if (!(await colors.isTransparent(background))) {
				if (background) record.originalBackground = background;

				await objc.invokeAsync(record.label, 'setBackgroundColor:', [await colors.clear]);
			}

			if (await objc.invokeAsync(record.label, 'isOpaque', [])) {
				await objc.invokeAsync(record.label, 'setOpaque:', [false]);
			}

			if (record.colors.join(':') !== stops.join(':') || record.style !== style) {
				// CAGradientLayer needs two stops, so a solid color is drawn as a flat gradient.
				const rendered = stops.length === 1 ? [stops[0], stops[0]] : stops;
				const cgColors = await Promise.all(rendered.map((color) => colors.cgColor(color)));

				if (cgColors.some((color) => !color)) return false;

				await objc.invokeAsync(record.layer, 'setColors:', [cgColors]);
				await objc.invokeAsync(record.layer, 'setLocations:', [
					rendered.map((_, index) => index / (rendered.length - 1)),
				]);
				await pointHorizontally(record.layer);
				await objc.invokeAsync(record.layer, 'setMasksToBounds:', [true]);
				await objc.invokeAsync(record.layer, 'setNeedsDisplay', []);

				if (style === 'holographic') {
					const sheen = record.sheen ? null : await createSheen(record.layer);

					if (sheen)
						record.sheen = { layer: sheen, frameSignature: '', cornerRadius: null };
				} else {
					await removeSheen(record);
				}

				record.colors = [...stops];
			}

			record.style = style;
			await fit(record);

			return true;
		} catch {
			return false;
		}
	}

	return { createLayer, paint, removeSheen };
}

export default { createGradientPainter };
