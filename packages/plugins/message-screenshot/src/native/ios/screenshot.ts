import { readNativeMessageInfo } from '@unbound-plugins/shared/native/ios/message-info';
import findVisibleCells from '@unbound-plugins/shared/native/ios/visible-cells';
import { readRect } from '@unbound-plugins/shared/native/ios/rect';
import type {
	NativeBridge,
	NativeFFISignature,
	NativeObjectHandle,
	NativePointer,
} from '@unbound-app/api/native';
import { metro } from '@unbound-app/api';

import type { ScreenshotOutput, ScreenshotResult } from '~/native/screenshot';
import { captureRegion, type Region } from '~/lib/pick';
import { toBase64 } from '~/lib/base64';

const CELL_CLASS = 'DCDMessageTableViewCell';
const PREMULTIPLIED_FIRST_LITTLE = 8194;

type Clipboard = { setImage(base64: string): void };

const Clipboard: Clipboard | undefined = metro.findByProps('setImage', 'getString', { lazy: true });

type Insets = { top?: number; bottom?: number; value?: Insets };

function chatArea(native: NativeBridge, cell: NativeObjectHandle): Region | undefined {
	const { objc } = native;
	let table = objc.invoke(cell, 'superview', []) as NativeObjectHandle | null;

	while (table && !objc.respondsTo(table, 'adjustedContentInset')) {
		table = objc.invoke(table, 'superview', []) as NativeObjectHandle | null;
	}

	if (!table) return undefined;

	const frame = readRect(
		objc.invoke(table, 'convertRect:toView:', [objc.invoke(table, 'bounds', []), null]),
	);
	const raw = objc.invoke(table, 'adjustedContentInset', []) as Insets | null;
	const insets = raw?.value ?? raw;
	const top = insets?.top ?? 0;
	const bottom = insets?.bottom ?? 0;

	return {
		x: frame.x,
		y: frame.y + top,
		width: frame.width,
		height: frame.height - top - bottom,
	};
}

async function rowFrames(native: NativeBridge, ids: string[]) {
	const { objc } = native;
	const frames: Region[] = [];
	let window: NativeObjectHandle | null = null;
	let area: Region | undefined;

	for (const cell of await findVisibleCells(objc, CELL_CLASS)) {
		const info = await readNativeMessageInfo(cell, objc);

		if (!info || !ids.includes(info.messageId)) continue;

		const bounds = objc.invoke(cell, 'bounds', []);

		frames.push(readRect(objc.invoke(cell, 'convertRect:toView:', [bounds, null])));
		window ??= objc.invoke(cell, 'window', []) as NativeObjectHandle | null;
		area ??= chatArea(native, cell);
	}

	return { frames, window, area };
}

function symbols(native: NativeBridge) {
	const { ffi } = native;
	const names = [
		'CGColorSpaceCreateDeviceRGB',
		'CGColorSpaceRelease',
		'CGBitmapContextCreate',
		'CGBitmapContextCreateImage',
		'CGContextRelease',
		'CGContextTranslateCTM',
		'CGContextScaleCTM',
		'CGImageRelease',
		'UIImagePNGRepresentation',
	] as const;
	const found = Object.fromEntries(names.map((name) => [name, ffi.symbol(name)]));

	return names.every((name) => found[name])
		? (found as Record<(typeof names)[number], NativePointer>)
		: undefined;
}

async function render(native: NativeBridge, window: NativeObjectHandle, region: Region) {
	const { objc, ffi } = native;
	const fns = symbols(native);
	const UIImage = objc.getClass('UIImage');
	const UIScreen = objc.getClass('UIScreen');

	if (!fns || !UIImage || !UIScreen) return undefined;

	const scale =
		Number(objc.invoke(objc.call(UIScreen, 'mainScreen') as NativeObjectHandle, 'scale', [])) ||
		2;
	const width = Math.round(region.width * scale);
	const height = Math.round(region.height * scale);
	const space = ffi.call(fns.CGColorSpaceCreateDeviceRGB, {
		returnType: 'pointer',
		args: [],
	}) as NativePointer;
	const context = ffi.call(
		fns.CGBitmapContextCreate,
		{ returnType: 'pointer', args: ['pointer', 'u64', 'u64', 'u64', 'u64', 'pointer', 'u32'] },
		null,
		width,
		height,
		8,
		0,
		space,
		PREMULTIPLIED_FIRST_LITTLE,
	) as NativePointer | null;
	const translate: NativeFFISignature = {
		returnType: 'void',
		args: ['pointer', 'double', 'double'],
	};

	try {
		if (!context) return undefined;

		ffi.call(fns.CGContextTranslateCTM, translate, context, 0, height);
		ffi.call(fns.CGContextScaleCTM, translate, context, scale, -scale);
		ffi.call(fns.CGContextTranslateCTM, translate, context, -region.x, -region.y);

		const layer = objc.invoke(window, 'layer', []) as NativeObjectHandle;

		await objc.invokeAsync(layer, 'renderInContext:', [context]);

		const cgImage = ffi.call(
			fns.CGBitmapContextCreateImage,
			{
				returnType: 'pointer',
				args: ['pointer'],
			},
			context,
		) as NativePointer | null;

		if (!cgImage) return undefined;

		try {
			const image = objc.call(
				UIImage,
				'imageWithCGImage:scale:orientation:',
				cgImage,
				scale,
				0,
			) as NativeObjectHandle | null;
			const png = image
				? ffi.call(
						fns.UIImagePNGRepresentation,
						{ returnType: 'object', args: ['object'] },
						image,
					)
				: undefined;

			return image && png instanceof Uint8Array ? { image, png } : undefined;
		} finally {
			ffi.call(fns.CGImageRelease, { returnType: 'void', args: ['pointer'] }, cgImage);
		}
	} finally {
		if (context)
			ffi.call(fns.CGContextRelease, { returnType: 'void', args: ['pointer'] }, context);
		ffi.call(fns.CGColorSpaceRelease, { returnType: 'void', args: ['pointer'] }, space);
	}
}

async function share(native: NativeBridge, window: NativeObjectHandle, image: NativeObjectHandle) {
	const { objc } = native;
	const NSArray = objc.getClass('NSArray');
	let presenter = objc.invoke(window, 'rootViewController', []) as NativeObjectHandle | null;

	while (presenter) {
		const presented = objc.invoke(
			presenter,
			'presentedViewController',
			[],
		) as NativeObjectHandle | null;

		if (!presented) break;

		presenter = presented;
	}

	if (!presenter || !NSArray) return false;

	const sheet = objc.create(
		'UIActivityViewController',
		'initWithActivityItems:applicationActivities:',
		[objc.call(NSArray, 'arrayWithObject:', image), null],
	) as NativeObjectHandle;
	const popover = objc.invoke(
		sheet,
		'popoverPresentationController',
		[],
	) as NativeObjectHandle | null;

	if (popover) objc.invoke(popover, 'setSourceView:', [objc.invoke(presenter, 'view', [])]);

	await objc.invokeAsync(presenter, 'presentViewController:animated:completion:', [
		sheet,
		true,
		null,
	]);

	return true;
}

/**
 * @description Captures the rows of the given messages as Discord draws them on iOS, by rendering the window's layer
 * over the rows' region into a bitmap, then shares or copies the picture.
 * @param native The plugin's native bridge.
 * @param ids The messages to include.
 * @param output Whether to open the share sheet or copy the picture.
 * @returns `not-visible` when none of the rows is on screen.
 */
export async function screenshotIOS(
	native: NativeBridge,
	ids: string[],
	output: ScreenshotOutput,
): Promise<ScreenshotResult> {
	const { frames, window, area } = await rowFrames(native, ids);
	const clip = area ?? (window ? readRect(native.objc.invoke(window, 'bounds', [])) : undefined);
	const region = clip ? captureRegion(frames, clip) : undefined;

	if (!window || !region) return 'not-visible';

	const rendered = await render(native, window, region);

	if (!rendered) throw new Error('rendering the rows failed');

	if (output === 'copy') {
		if (!Clipboard) throw new Error('no clipboard module');

		Clipboard.setImage(toBase64(rendered.png));
	} else if (!(await share(native, window, rendered.image))) {
		throw new Error('no view controller to present the share sheet from');
	}

	return 'done';
}

export default screenshotIOS;
