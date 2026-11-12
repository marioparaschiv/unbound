import type {
	NativeFFIBridge,
	NativeHandle,
	NativeObjCBridge,
	NativeObjCResult,
} from '@unbound-app/types';

import type { CardOp, DebugCard } from './debug-card';

type IOSBridges = {
	objc: Pick<NativeObjCBridge, 'call' | 'getClass' | 'struct'>;
	ffi: NativeFFIBridge;
};

function symbol(ffi: NativeFFIBridge, name: string) {
	const pointer = ffi.symbol(name);

	if (!pointer) {
		throw new Error(`UIKit has no ${name}`);
	}

	return pointer;
}

function isHandle(value: unknown): value is NativeHandle {
	return typeof value === 'object' && value !== null;
}

function handle(value: NativeObjCResult | NativeHandle | null, what: string): NativeHandle {
	if (!isHandle(value)) {
		throw new Error(`UIKit returned no ${what}`);
	}

	return value;
}

function cls({ objc }: IOSBridges, name: string): NativeHandle {
	return handle(objc.getClass(name), name);
}

function color(bridges: IOSBridges, hex: string): NativeHandle {
	const { objc } = bridges;
	const rgb = Number.parseInt(hex.slice(1), 16);

	const created = objc.call(
		cls(bridges, 'UIColor'),
		'colorWithRed:green:blue:alpha:',
		((rgb >> 16) & 0xff) / 255,
		((rgb >> 8) & 0xff) / 255,
		(rgb & 0xff) / 255,
		1,
	);

	return handle(created, 'color');
}

function rect({ objc }: IOSBridges, x: number, y: number, width: number, height: number) {
	return objc.struct('CGRect', { origin: { x, y }, size: { width, height } });
}

function draw(bridges: IOSBridges, op: CardOp) {
	const { objc } = bridges;
	const paint = color(bridges, op.color);
	const paths = cls(bridges, 'UIBezierPath');

	if (op.kind === 'text') {
		const font = handle(
			objc.call(cls(bridges, 'UIFont'), 'monospacedSystemFontOfSize:weight:', op.size, 0),
			'font',
		);
		const text = handle(
			objc.call(
				handle(objc.call(cls(bridges, 'NSAttributedString'), 'alloc'), 'string'),
				'initWithString:attributes:',
				op.text,
				{ NSFont: font, NSColor: paint },
			),
			'string',
		);
		const ascender = Number(objc.call(font, 'ascender'));

		objc.call(text, 'drawAtPoint:', objc.struct('CGPoint', { x: op.x, y: op.y - ascender }));

		return;
	}

	if (op.kind === 'circle') {
		objc.call(paint, 'setFill');
		const oval = objc.call(
			paths,
			'bezierPathWithOvalInRect:',
			rect(bridges, op.x - op.radius, op.y - op.radius, op.radius * 2, op.radius * 2),
		);

		objc.call(handle(oval, 'path'), 'fill');

		return;
	}

	const path = handle(
		objc.call(
			paths,
			'bezierPathWithRoundedRect:cornerRadius:',
			rect(bridges, op.x, op.y, op.width, op.height),
			op.radius,
		),
		'path',
	);

	if (op.stroke) {
		objc.call(paint, 'setStroke');
		objc.call(path, 'setLineWidth:', 1);
		objc.call(path, 'stroke');
	} else {
		objc.call(paint, 'setFill');
		objc.call(path, 'fill');
	}
}

/**
 * @description Draws the debug card in a UIKit image context and writes it as a PNG.
 * @param bridges The Objective-C and FFI bridges.
 * @param card The laid-out card.
 * @param path The file to write.
 */
export function renderDebugCardIos(bridges: IOSBridges, card: DebugCard, path: string): void {
	const { ffi } = bridges;

	ffi.call(
		symbol(ffi, 'UIGraphicsBeginImageContextWithOptions'),
		{ returnType: 'void', args: [{ struct: 'CGSize' }, 'bool', 'double'] },
		{ width: card.width, height: card.height },
		false,
		card.scale,
	);

	try {
		for (const op of card.ops) draw(bridges, op);

		const image = ffi.call(symbol(ffi, 'UIGraphicsGetImageFromCurrentImageContext'), {
			returnType: 'object',
			args: [],
		});
		const png = ffi.call(
			symbol(ffi, 'UIImagePNGRepresentation'),
			{ returnType: 'pointer', args: ['object'] },
			image,
		);
		const written =
			png !== null &&
			ffi.call(
				symbol(ffi, 'objc_msgSend'),
				{ returnType: 'bool', args: ['pointer', 'selector', 'object', 'bool'] },
				png,
				'writeToFile:atomically:',
				path,
				true,
			);

		if (!written) {
			throw new Error(`Failed to write the debug card to ${path}`);
		}
	} finally {
		ffi.call(symbol(ffi, 'UIGraphicsEndImageContext'), {
			returnType: 'void',
			args: [],
		});
	}
}

export default renderDebugCardIos;
