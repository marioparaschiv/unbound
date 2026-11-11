import type { PluginSelfTestResult } from '@unbound-app/api/global';

/**
 * @description Builds a self-test that passes only once the plugin drew something, for the device matrix, which opens fixture messages first.
 * Unbound fails the plugin first when it logged a warning or error while starting.
 * @param drawn How many things the plugin has drawn on screen, or `undefined` when it never started drawing.
 * @param noun What it draws, plural, such as `embeds`.
 * @param settling Reads whether the plugin is still drawing what is on screen.
 * @returns `ok` when at least one thing is drawn.
 */
export function drawnSelfTest(
	drawn: (() => number) | undefined,
	noun: string,
	settling?: () => boolean,
): PluginSelfTestResult {
	const count = drawn?.() ?? 0;

	return count > 0
		? {
				ok: true,
				detail: `${count} ${noun} drawn on screen`,
				...(settling?.() ? { settling: true } : {}),
			}
		: { ok: false, detail: `no ${noun} are drawn on screen`, nothingDrawn: true };
}

export default drawnSelfTest;
