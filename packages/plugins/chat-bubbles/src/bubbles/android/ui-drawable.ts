import type {
	NativeJavaBridge,
	NativeJavaReference,
	NativeJavaValue,
} from '@unbound-app/api/native';
import {
	javaFloat,
	javaInt,
	javaReference,
	javaString,
} from '@unbound-plugins/shared/native/android/java-values';

/** The bubble's fill, outline and quote box, sized to the row it was measured in, in pixels. */
export type BubbleDrawing = {
	width: number;
	height: number;
	fill: string;
	color: number;
	outline?: { path: string; color: number; width: number };
	quote?: {
		box: { x: number; y: number; width: number; height: number };
		color: number;
		radius: number;
	};
};

const TOP_LEFT = 0x33;

function pathShape(java: NativeJavaBridge, data: string, width: number, height: number) {
	'worklet';
	const parser = java.getClass('android.util.PathParser');
	const path = javaReference(java.invoke(parser, 'createPathFromPathData', [javaString(data)]));

	if (!path) return;

	const shape = java.construct('android.graphics.drawable.shapes.PathShape', [
		path,
		javaFloat(width),
		javaFloat(height),
	]);

	return java.construct('android.graphics.drawable.ShapeDrawable', [shape]);
}

function paintOf(java: NativeJavaBridge, drawable: NativeJavaReference) {
	'worklet';
	const paint = javaReference(java.invoke(drawable, 'getPaint', []));

	if (paint) java.invoke(paint, 'setAntiAlias', [{ type: 'boolean', value: true }]);

	return paint;
}

/**
 * @description Builds a bubble as a `LayerDrawable` for a row's background: its path filled, an outline inside its edge, and a quote box, each pinned to the row's top left so a taller row never stretches them.
 * @param java The UI scope's Java bridge.
 * @param drawing The bubble's paths, colors and size in pixels.
 * @param layerId The id the fill layer gets, so the bubble can be told apart from Discord's backgrounds.
 * @returns The drawable, or `undefined` when its path could not be parsed.
 */
export function bubbleDrawable(
	java: NativeJavaBridge,
	drawing: BubbleDrawing,
	layerId: number,
): NativeJavaReference | undefined {
	'worklet';
	const { width, height } = drawing;
	const fill = pathShape(java, drawing.fill, width, height);

	if (!fill) return;

	const fillPaint = paintOf(java, fill);

	if (fillPaint) java.invoke(fillPaint, 'setColor', [javaInt(drawing.color)]);

	const layers: NativeJavaReference[] = [fill];
	const sizes: { x: number; y: number; width: number; height: number }[] = [
		{ x: 0, y: 0, width, height },
	];
	const quote = drawing.quote;

	if (quote) {
		const box = java.construct('android.graphics.drawable.GradientDrawable', []);

		java.invoke(box, 'setColor', [javaInt(quote.color)]);
		java.invoke(box, 'setCornerRadius', [javaFloat(quote.radius)]);
		layers.push(box);
		sizes.push(quote.box);
	}

	const outline = drawing.outline && pathShape(java, drawing.outline.path, width, height);

	if (outline && drawing.outline) {
		const paint = paintOf(java, outline);
		const stroke = java.getField(java.getClass('android.graphics.Paint$Style'), 'STROKE');

		if (paint) {
			java.invoke(paint, 'setStyle', [stroke]);
			java.invoke(paint, 'setStrokeWidth', [javaFloat(drawing.outline.width)]);
			java.invoke(paint, 'setColor', [javaInt(drawing.outline.color)]);
		}

		layers.push(outline);
		sizes.push({ x: 0, y: 0, width, height });
	}

	const bubble = java.construct('android.graphics.drawable.LayerDrawable', [
		{
			type: 'array',
			componentType: 'android.graphics.drawable.Drawable',
			value: layers as NativeJavaValue[],
		},
	]);

	sizes.forEach((size, index) => {
		java.invoke(bubble, 'setLayerGravity', [javaInt(index), javaInt(TOP_LEFT)]);
		java.invoke(bubble, 'setLayerInsetLeft', [javaInt(index), javaInt(Math.round(size.x))]);
		java.invoke(bubble, 'setLayerInsetTop', [javaInt(index), javaInt(Math.round(size.y))]);
		java.invoke(bubble, 'setLayerSize', [
			javaInt(index),
			javaInt(Math.round(size.width)),
			javaInt(Math.round(size.height)),
		]);
	});
	java.invoke(bubble, 'setId', [javaInt(0), javaInt(layerId)]);
	java.invoke(bubble, 'setPadding', [javaInt(0), javaInt(0), javaInt(0), javaInt(0)]);

	return bubble;
}

export default { bubbleDrawable };
