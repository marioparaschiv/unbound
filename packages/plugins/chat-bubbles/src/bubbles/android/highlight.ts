import type {
	NativeJavaBridge,
	NativeJavaReference,
	NativeJavaValue,
} from '@unbound-app/api/native';
import { runOnMain } from '@unbound-plugins/shared/native/android/views';
import {
	javaInt,
	javaNumber,
	javaReference,
	javaText,
} from '@unbound-plugins/shared/native/android/java-values';

import type { HighlightPainter } from '~/bubbles/android/ui-bubbles';
import type { BubbleColor } from '~/bubbles/style';

const CANVAS = 'android.graphics.Canvas';
const RECYCLER_VIEW = 'androidx.recyclerview.widget.RecyclerView';
const VIEW = 'android.view.View';

function painterOf(java: NativeJavaBridge, className: string): HighlightPainter | undefined {
	const shape = java.describe(className);
	const method = shape.methods.find(
		({ parameters, returnType, static: isStatic }) =>
			!isStatic &&
			returnType === 'void' &&
			parameters.length === 2 &&
			parameters[0] === CANVAS &&
			parameters[1] === VIEW,
	);
	const fields = shape.fields.filter((field) => !field.static);
	const background = fields.findIndex((field) => field.type === 'java.io.Serializable');
	// Discord sets the tint's background color, then its bar's, in the two fields declared together.
	const bar = fields[background + 1];

	if (!method || background < 0 || !bar) return;

	return { className, method: method.name, background: fields[background]!.name, bar: bar.name };
}

// RecyclerView's own methods are obfuscated too, so its item decorations are read from whichever of its list fields hold objects.
async function listedObjects(java: NativeJavaBridge, list: NativeJavaReference) {
	const fields = java
		.describe(RECYCLER_VIEW)
		.fields.filter((field) => !field.static && field.type === 'java.util.ArrayList');
	const lists = await runOnMain(
		java,
		fields.map((field) => ({ op: 'getField' as const, handle: list, name: field.name })),
	);
	const objects: NativeJavaValue[] = [];

	for (const value of lists) {
		const held = javaReference(value);
		const size = held ? (javaNumber(java.invoke(held, 'size', [])) ?? 0) : 0;

		for (let index = 0; index < size; index++) {
			objects.push(java.invoke(held!, 'get', [javaInt(index)]));
		}
	}

	return objects;
}

/**
 * @description Finds the method Discord's chat list paints a row's mention and highlight tint with: an item decoration's helper that draws on a canvas behind one view, reading its colors from two fields set before each row. Discord obfuscates all of it, so it is found by its shape.
 * @param java The plugin's Java bridge.
 * @param row A message row in the chat list.
 * @returns The painter's class, method and color fields, or `undefined` when the list has none.
 */
export async function findHighlightPainter(
	java: NativeJavaBridge,
	row: NativeJavaReference,
): Promise<HighlightPainter | undefined> {
	const list = javaReference(await java.invokeAsync(row, 'getParent', []));

	if (!list) return;

	for (const decoration of await listedObjects(java, list)) {
		const reference = javaReference(decoration);
		const name = reference ? javaText(java.className(reference)) : undefined;

		if (!name) continue;

		for (const field of java.describe(name).fields) {
			if (
				field.static ||
				field.type.startsWith('java.') ||
				field.type.startsWith('android.')
			) {
				continue;
			}

			try {
				const painter = painterOf(java, field.type);

				if (painter) return painter;
			} catch {
				// A primitive or missing type has no shape to read.
			}
		}
	}
}

/**
 * @description Unpacks an Android ARGB color.
 * @param value The signed 32-bit ARGB value.
 * @returns The color's channels from 0 to 1.
 */
export function colorFromArgb(value: number): BubbleColor {
	const channel = (shift: number) => ((value >>> shift) & 0xff) / 255;

	return { alpha: channel(24), red: channel(16), green: channel(8), blue: channel(0) };
}

export default { colorFromArgb, findHighlightPainter };
