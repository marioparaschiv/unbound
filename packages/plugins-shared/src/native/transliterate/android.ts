import type { NativeBridge } from '@unbound-app/api/native';

const TRANSLITERATOR = 'android.icu.text.Transliterator';

function javaString(value: string) {
	return { type: 'string', value } as const;
}

/**
 * @description Runs an ICU transform such as `Han-Latin` over text with Android's `android.icu` transliterator.
 * @param bridge The plugin's native bridge.
 * @param text The text.
 * @param transform The ICU transform id.
 * @returns The transformed text, or `undefined` when the transform is unknown.
 */
export async function transliterateAndroid(
	{ java }: NativeBridge,
	text: string,
	transform: string,
): Promise<string | undefined> {
	const transliterator = await java.invokeAsync(java.getClass(TRANSLITERATOR), 'getInstance', [
		javaString(transform),
	]);

	if (transliterator?.type !== 'handle') return undefined;

	const result = await java.invokeAsync(transliterator, 'transliterate', [javaString(text)]);

	return result?.type === 'string' ? result.value : undefined;
}

export default transliterateAndroid;
