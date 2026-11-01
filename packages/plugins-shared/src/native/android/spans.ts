import {
	javaInt,
	javaNumber,
	javaReference,
	javaText,
} from '@unbound-plugins/shared/native/android/java-values';
import type { NativeJavaBridge, NativeJavaReference } from '@unbound-app/api/native';

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
 * @description Tells whether a text holds any span of a class, with one call that reads neither its string nor its spans, so callers can skip texts that cannot interest them.
 * @param java The plugin's Java bridge.
 * @param text The `CharSequence`.
 * @param className The span class or interface, like `android.text.style.ClickableSpan`.
 * @returns Whether the text holds such a span; `false` for plain text.
 */
export function hasSpan(java: SpanBridge, text: NativeJavaReference, className: string): boolean {
	try {
		const spanClass = java.getClass(className);
		const length = javaNumber(java.invoke(text, 'length', [])) ?? 0;

		if (!spanClass || !length) {
			return false;
		}

		const next = javaNumber(
			java.invoke(text, 'nextSpanTransition', [javaInt(0), javaInt(length), spanClass]),
		);

		return next !== undefined && next < length;
	} catch {
		return false;
	}
}

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
 * @description Reads a text view's text on the main thread.
 * @param java The plugin's Java bridge.
 * @param view The text view.
 * @returns The text and its string, or `null` when the view has no text.
 */
export async function readViewTextAsync(
	java: SpanBridge & Pick<NativeJavaBridge, 'invokeAsync'>,
	view: NativeJavaReference,
): Promise<ViewText | null> {
	const text = javaReference(await java.invokeAsync(view, 'getText', []));
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
