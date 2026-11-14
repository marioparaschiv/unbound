import type { NativeBridge, NativeObjectHandle, NativePointer } from '@unbound-app/api/native';

import { pngSize } from '~/lib/png';

/** The size Discord lays a rasterized SVG out at, in points. */
export type Raster = { width: number; height: number };

const CORE_SVG = '/System/Library/PrivateFrameworks/CoreSVG.framework/CoreSVG';
const SCREEN_SCALE = 3;
const MIN_SIDE = 160;
const MAX_SIDE = 1024;

/**
 * @description Draws an SVG file as a PNG with CoreSVG, the renderer UIKit uses for vector assets.
 * @param native The plugin's native bridge.
 * @param svgPath The absolute path of the SVG file.
 * @param pngPath The absolute path to write the PNG to.
 * @returns The picture's size in points, or `undefined` when CoreSVG cannot read the file.
 */
export async function rasterizeSvgIOS(
	native: NativeBridge,
	svgPath: string,
	pngPath: string,
): Promise<Raster | undefined> {
	const { objc, ffi } = native;
	const createDocument = ffi.symbol('CGSVGDocumentCreateFromURL', CORE_SVG);
	const releaseDocument = ffi.symbol('CGSVGDocumentRelease', CORE_SVG);
	const pngData = ffi.symbol('UIImagePNGRepresentation');
	const NSURL = objc.getClass('NSURL');
	const UIImage = objc.getClass('UIImage');

	if (!createDocument || !pngData || !NSURL || !UIImage) return undefined;

	const url = objc.call(NSURL, 'fileURLWithPath:', svgPath) as NativeObjectHandle;
	const document = ffi.call(
		createDocument,
		{ returnType: 'pointer', args: ['object', 'pointer'] },
		url,
		null,
	) as NativePointer | null;

	if (!document) return undefined;

	try {
		const draw = (scale: number) => {
			const image = objc.call(
				UIImage,
				'_imageWithCGSVGDocument:scale:orientation:',
				document,
				scale,
				0,
			) as NativeObjectHandle | null;
			const bytes = image
				? ffi.call(pngData, { returnType: 'object', args: ['object'] }, image)
				: undefined;

			return bytes instanceof Uint8Array ? { bytes, size: pngSize(bytes) } : undefined;
		};
		const measured = draw(1)?.size;

		if (!measured) return undefined;

		const longest = Math.max(measured.width, measured.height);
		const zoom = Math.min(Math.max(1, MIN_SIDE / longest), MAX_SIDE / longest);
		const drawn = draw(SCREEN_SCALE * zoom);

		if (
			!drawn?.size ||
			objc.call(objc.data(drawn.bytes), 'writeToFile:atomically:', pngPath, true) !== true
		) {
			return undefined;
		}

		return {
			width: Math.round(measured.width * zoom),
			height: Math.round(measured.height * zoom),
		};
	} finally {
		if (releaseDocument)
			ffi.call(releaseDocument, { returnType: 'void', args: ['pointer'] }, document);
	}
}
