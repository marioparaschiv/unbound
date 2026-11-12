import type { NativeJavaBridge, NativeJavaReference, NativeJavaValue } from '@unbound-app/types';

import type { CardOp, DebugCard } from './debug-card';

const ANTI_ALIAS = 1;

const int = (value: number): NativeJavaValue => ({
	type: 'int',
	value: Math.round(value),
});
const float = (value: number): NativeJavaValue => ({ type: 'float', value });

function reference(value: NativeJavaValue, what: string): NativeJavaReference {
	if (value.type !== 'handle') {
		throw new Error(`Android returned no ${what}`);
	}

	return value;
}

function argb(hex: string): number {
	return 0xff000000 | Number.parseInt(hex.slice(1), 16) | 0;
}

/**
 * @description Draws the debug card into a bitmap with Android's `Canvas` and writes it as a PNG.
 * @param java The Java bridge.
 * @param card The laid-out card.
 * @param path The file to write.
 */
export function renderDebugCardAndroid(
	java: NativeJavaBridge,
	card: DebugCard,
	path: string,
): void {
	const config = java.getField(java.getClass('android.graphics.Bitmap$Config'), 'ARGB_8888');
	const bitmap = reference(
		java.invoke(java.getClass('android.graphics.Bitmap'), 'createBitmap', [
			int(card.width * card.scale),
			int(card.height * card.scale),
			config,
		]),
		'bitmap',
	);
	const canvas = java.construct('android.graphics.Canvas', [bitmap]);
	const paint = java.construct('android.graphics.Paint', [int(ANTI_ALIAS)]);
	const styles = java.getClass('android.graphics.Paint$Style');
	const fill = java.getField(styles, 'FILL');
	const stroke = java.getField(styles, 'STROKE');

	java.invoke(canvas, 'scale', [float(card.scale), float(card.scale)]);
	java.invoke(paint, 'setTypeface', [
		java.getField(java.getClass('android.graphics.Typeface'), 'MONOSPACE'),
	]);

	function draw(op: CardOp) {
		java.invoke(paint, 'setColor', [int(argb(op.color))]);

		if (op.kind === 'text') {
			java.invoke(paint, 'setStyle', [fill]);
			java.invoke(paint, 'setTextSize', [float(op.size)]);
			java.invoke(canvas, 'drawText', [
				{ type: 'string', value: op.text },
				float(op.x),
				float(op.y),
				paint,
			]);

			return;
		}

		if (op.kind === 'circle') {
			java.invoke(paint, 'setStyle', [fill]);
			java.invoke(canvas, 'drawCircle', [float(op.x), float(op.y), float(op.radius), paint]);

			return;
		}

		java.invoke(paint, 'setStyle', [op.stroke ? stroke : fill]);
		java.invoke(paint, 'setStrokeWidth', [float(1)]);
		java.invoke(canvas, 'drawRoundRect', [
			float(op.x),
			float(op.y),
			float(op.x + op.width),
			float(op.y + op.height),
			float(op.radius),
			float(op.radius),
			paint,
		]);
	}

	for (const op of card.ops) {
		draw(op);
	}

	const stream = java.construct('java.io.FileOutputStream', [{ type: 'string', value: path }]);
	const format = java.getField(java.getClass('android.graphics.Bitmap$CompressFormat'), 'PNG');

	try {
		java.invoke(bitmap, 'compress', [format, int(100), stream]);
	} finally {
		java.invoke(stream, 'close', []);
		java.invoke(bitmap, 'recycle', []);
	}
}

export default renderDebugCardAndroid;
