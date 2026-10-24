import type { NativeJavaBridge, NativeJavaReference } from '@unbound-app/api/native';

import { javaInt, javaNumber, javaReference, javaText } from './java-values';

export type SpanBridge = Pick<NativeJavaBridge, 'getClass' | 'invoke'>;

export type SpanRange = {
	start: number;
	end: number;
};

export type ViewText = {
	text: NativeJavaReference;
	string: string;
};

export type SpanHit = SpanRange & {
	span: NativeJavaReference;
	flags: number;
};

/**
 * @description Reads a text view's text and its plain string.
 * @param java The plugin's Java bridge.
 * @param view The `TextView`.
 * @returns The `CharSequence` and its string, or `null` when the view has no text.
 */
export function readViewText(java: SpanBridge, view: NativeJavaReference): ViewText | null {
	const text = javaReference(java.invoke(view, 'getText', []));
	const string = text ? javaText(java.invoke(text, 'toString', [])) : undefined;

	return text && string !== undefined ? { text, string } : null;
}

/**
 * @description Lists the spans of one class over a whole `Spanned`, with their ranges and flags.
 * @param java The plugin's Java bridge.
 * @param text The `Spanned`.
 * @param length The text's length.
 * @param className The span class, such as `android.text.style.ForegroundColorSpan`.
 * @returns Each span in the order Android reports them.
 */
export function spansOf(
	java: SpanBridge,
	text: NativeJavaReference,
	length: number,
	className: string,
): SpanHit[] {
	const reflection = java.getClass('java.lang.reflect.Array');
	const spans = javaReference(
		java.invoke(text, 'getSpans', [javaInt(0), javaInt(length), java.getClass(className)]),
	);
	const count = spans ? (javaNumber(java.invoke(reflection, 'getLength', [spans])) ?? 0) : 0;
	const hits: SpanHit[] = [];

	for (let position = 0; spans && position < count; position++) {
		const span = javaReference(java.invoke(reflection, 'get', [spans, javaInt(position)]));

		if (!span) {
			continue;
		}

		hits.push({
			span,
			start: javaNumber(java.invoke(text, 'getSpanStart', [span])) ?? -1,
			end: javaNumber(java.invoke(text, 'getSpanEnd', [span])) ?? -1,
			flags: javaNumber(java.invoke(text, 'getSpanFlags', [span])) ?? 0,
		});
	}

	return hits;
}

export default { readViewText, spansOf };
