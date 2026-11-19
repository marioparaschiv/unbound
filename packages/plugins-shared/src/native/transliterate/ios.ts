import type { NativeBridge } from '@unbound-app/api/native';

/**
 * @description Runs an ICU transform such as `Han-Latin` over text with Foundation's `applyingTransform`.
 * @param bridge The plugin's native bridge.
 * @param text The text.
 * @param transform The ICU transform id.
 * @returns The transformed text, or `undefined` when the transform is unknown.
 */
export async function transliterateIOS(
	{ objc }: NativeBridge,
	text: string,
	transform: string,
): Promise<string | undefined> {
	const source = objc.create('NSString', 'initWithString:', [text]);
	const result = await objc.invokeAsync(source, 'stringByApplyingTransform:reverse:', [
		transform,
		false,
	]);

	return typeof result === 'string' ? result : undefined;
}

export default transliterateIOS;
