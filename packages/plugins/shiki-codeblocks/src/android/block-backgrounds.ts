import type { NativeJavaBridge, NativeJavaReference } from '@unbound-app/api/native';
import { hasShapeConstructor } from '@unbound-plugins/shared/native/android/discord-shapes';
import { javaText } from '@unbound-plugins/shared/native/android/java-values';
import { legacyJavaClass } from '@unbound-plugins/shared/native/android/legacy-classes';
import { spansOf, type SpanHit } from '@unbound-plugins/shared/native/android/spans';

const BLOCK_BACKGROUND_SPAN = legacyJavaClass(
	'com.discord.span.utilities.spannable.BlockBackgroundSpan',
);
const LINE_BACKGROUND_SPAN = 'android.text.style.LineBackgroundSpan';

/**
 * @description Creates a finder for the spans Discord draws code block backgrounds with. Newer builds obfuscate the span's name, so it is recognised by the `blockBackgroundSpan` shape: the line background span built from seven colours and sizes.
 * @param java The Java bridge.
 * @returns A function listing the block background spans of a text.
 */
export function createBlockBackgroundFinder(java: NativeJavaBridge) {
	const matches = new Map<string, boolean>();

	function isBlockBackground(span: NativeJavaReference): boolean {
		const name = javaText(java.className(span));

		if (!name) return false;
		if (name === BLOCK_BACKGROUND_SPAN) return true;

		const cached = matches.get(name);

		if (cached !== undefined) return cached;

		const match = hasShapeConstructor(java, 'blockBackgroundSpan', name);

		matches.set(name, match);

		return match;
	}

	return (text: NativeJavaReference, length: number): SpanHit[] =>
		spansOf(java, text, length, LINE_BACKGROUND_SPAN).filter((hit) =>
			isBlockBackground(hit.span),
		);
}
