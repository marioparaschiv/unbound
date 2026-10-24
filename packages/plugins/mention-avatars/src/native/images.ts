import type { NativeStruct } from '@unbound-app/api/native';

import type { Bridge, Handle } from '~/native/bridge';

type Size = {
	width: number;
	height: number;
};

type Rect = {
	size: Size;
};

function uiColor(bridge: Bridge, rgb: number): Handle | null {
	const UIColor = bridge.objc.getClass('UIColor');

	if (!UIColor) return null;

	return bridge.handle(
		UIColor,
		'colorWithRed:green:blue:alpha:',
		((rgb >> 16) & 0xff) / 255,
		((rgb >> 8) & 0xff) / 255,
		(rgb & 0xff) / 255,
		1,
	);
}

function tint(bridge: Bridge, image: Handle, color: Handle): Handle {
	if (bridge.objc.respondsTo(image, 'imageWithTintColor:renderingMode:')) {
		return bridge.handle(image, 'imageWithTintColor:renderingMode:', color, 1) ?? image;
	}

	if (bridge.objc.respondsTo(image, 'imageWithTintColor:')) {
		return bridge.handle(image, 'imageWithTintColor:', color) ?? image;
	}

	return image;
}

// Text attachments drop a symbol's tint, so the color is baked into a bitmap with CIFalseColor.
function rasterize(bridge: Bridge, image: Handle, color: Handle): Handle {
	const classes = bridge.classes('UIImage', 'CIImage', 'CIColor', 'CIFilter', 'CIContext');

	if (!classes) return image;

	const [UIImage, CIImage, CIColor, CIFilter, CIContext] = classes;
	const sourceCGImage = bridge.call(image, 'CGImage');
	const tintCGColor = bridge.call(color, 'CGColor');

	if (!sourceCGImage || !tintCGColor) return image;

	const source = bridge.handle(CIImage, 'imageWithCGImage:', sourceCGImage);
	const ciColor = bridge.handle(CIColor, 'colorWithCGColor:', tintCGColor);
	const filter = bridge.handle(CIFilter, 'filterWithName:', 'CIFalseColor');

	if (!source || !ciColor || !filter) return image;

	bridge.setValues(filter, { inputImage: source, inputColor0: ciColor, inputColor1: ciColor });

	const output = bridge.handle(filter, 'outputImage');

	if (!output) return image;

	const size = (bridge.call(image, 'size') as NativeStruct<Size> | null)?.value;
	const extent = (bridge.call(output, 'extent') as NativeStruct<Rect> | null)?.value;
	const scale = bridge.number(image, 'scale');
	const dimensions = [size?.width, size?.height, extent?.size.width, extent?.size.height, scale];
	const sized =
		size &&
		extent &&
		dimensions.every((value) => value !== undefined && Number.isFinite(value) && value > 0)
			? (bridge.handle(
					output,
					'imageByApplyingTransform:',
					bridge.objc.struct('CGAffineTransform', {
						a: (size.width * scale) / extent.size.width,
						b: 0,
						c: 0,
						d: (size.height * scale) / extent.size.height,
						tx: 0,
						ty: 0,
					}),
				) ?? output)
			: output;
	const sizedExtent = bridge.call(sized, 'extent');
	const context = bridge.handle(CIContext, 'contextWithOptions:', null);
	const bitmap =
		sizedExtent && context
			? bridge.call(context, 'createCGImage:fromRect:', sized, sizedExtent)
			: null;

	if (!bitmap) return image;

	return (
		bridge.handle(
			UIImage,
			'imageWithCGImage:scale:orientation:',
			bitmap,
			scale || 1,
			bridge.call(image, 'imageOrientation') ?? 0,
		) ?? image
	);
}

/**
 * @description Loads the SF Symbol shown on role mentions without a custom icon.
 * @param bridge The plugin's native bridge.
 * @returns The untinted symbol image, or `null` when UIKit cannot provide it.
 */
export function roleSymbol(bridge: Bridge): Handle | null {
	const UIImage = bridge.objc.getClass('UIImage');

	if (!UIImage) return null;

	const UIImageSymbolConfiguration = bridge.objc.getClass('UIImageSymbolConfiguration');
	const configuration =
		UIImageSymbolConfiguration &&
		bridge.handle(
			UIImageSymbolConfiguration,
			'configurationWithPointSize:weight:scale:',
			14,
			0,
			1,
		);

	if (configuration && bridge.objc.respondsTo(UIImage, 'systemImageNamed:withConfiguration:')) {
		return bridge.handle(
			UIImage,
			'systemImageNamed:withConfiguration:',
			'person.2.fill',
			configuration,
		);
	}

	return bridge.handle(UIImage, 'systemImageNamed:', 'person.2.fill');
}

/**
 * @description Colors the role symbol with the role's color, or the label color when it has none.
 * @param bridge The plugin's native bridge.
 * @param symbol The image from {@link roleSymbol}.
 * @param roleColor The role's RGB color.
 * @returns The tinted bitmap, or `symbol` when it cannot be tinted.
 */
export function tintRoleSymbol(bridge: Bridge, symbol: Handle, roleColor?: number): Handle {
	const UIColor = bridge.objc.getClass('UIColor');
	const color = roleColor
		? uiColor(bridge, roleColor)
		: UIColor && bridge.handle(UIColor, 'labelColor');

	if (!color) return symbol;

	return rasterize(bridge, tint(bridge, symbol, color), color);
}

/**
 * @description Crops a 32px avatar to a circle.
 * @param bridge The plugin's native bridge.
 * @param image The square avatar.
 * @returns The circular avatar, or `image` when Core Image cannot render it.
 */
export function roundedAvatar(bridge: Bridge, image: Handle): Handle {
	const classes = bridge.classes(
		'UIImage',
		'CIImage',
		'CIContext',
		'CIFilter',
		'CIColor',
		'CIVector',
	);

	if (!classes) return image;

	const [UIImage, CIImage, CIContext, CIFilter, CIColor, CIVector] = classes;
	const sourceCGImage = bridge.call(image, 'CGImage');

	if (!sourceCGImage) return image;

	const source = bridge.handle(CIImage, 'imageWithCGImage:', sourceCGImage);
	const mask = bridge.handle(CIFilter, 'filterWithName:', 'CIRadialGradient');

	if (!source || !mask) return image;

	const white = bridge.handle(CIColor, 'colorWithRed:green:blue:alpha:', 1, 1, 1, 1);
	const clear = bridge.handle(CIColor, 'colorWithRed:green:blue:alpha:', 0, 0, 0, 0);
	const center = bridge.handle(CIVector, 'vectorWithX:Y:', 16, 16);

	if (!white || !clear || !center) return image;

	bridge.setValues(mask, {
		inputCenter: center,
		inputRadius0: 15.5,
		inputRadius1: 16,
		inputColor0: white,
		inputColor1: clear,
	});

	const maskImage = bridge.handle(mask, 'outputImage');
	const blend = bridge.handle(CIFilter, 'filterWithName:', 'CIBlendWithMask');

	if (!maskImage || !blend) return image;

	bridge.setValues(blend, { inputImage: source, inputMaskImage: maskImage });

	const output = bridge.handle(blend, 'outputImage');

	if (!output) return image;

	const rect = bridge.objc.struct('CGRect', {
		origin: { x: 0, y: 0 },
		size: { width: 32, height: 32 },
	});
	const context = bridge.handle(CIContext, 'contextWithOptions:', null);
	const cgImage = context && bridge.call(context, 'createCGImage:fromRect:', output, rect);

	if (!cgImage) return image;

	return (
		bridge.handle(
			UIImage,
			'imageWithCGImage:scale:orientation:',
			cgImage,
			2,
			bridge.call(image, 'imageOrientation') ?? 0,
		) ?? image
	);
}

export default { roleSymbol, tintRoleSymbol, roundedAvatar };
