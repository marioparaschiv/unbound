import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import type { PluginSelfTestResult } from '@unbound-app/api/global';
import type { PluginContext } from '@unbound-app/api/native';
import { native } from '@unbound-app/api';

import { startCards as android } from '~/native/android/start';
import { startCards as ios } from '~/native/ios/start';
import { createHighlighter } from '~/lib/highlighter';
import { readPreferences } from '~/lib/preferences';
import type { Cards } from '~/lib/types';

const startCards = native.definePlatform({ ios, android });

// The running plugin's cards, which `stopCodeCards` removes and the self-test reads.
let cards: Cards | undefined;

/**
 * @description Draws syntax-highlighted code cards in place of code blocks in messages, natively on iOS and Android.
 * Reads `MessageStore` and `SelectedChannelStore`, and hooks Discord's native message cells and text views through
 * the platform handler. The native hooks are outside the Addon scope, so `stopCodeCards` removes them.
 * @param context The plugin context, whose native bridge and granted capabilities the cards need.
 */
export function drawCodeCards(context: PluginContext): void {
	if (!ensureCapabilities(context.native, context.capabilities, 'Code cards')) {
		return;
	}

	cards = startCards(context.native);
}

/**
 * @description Removes the cards and restores Discord's text.
 * @returns A promise when native work must finish before the plugin's native scope closes.
 */
export function stopCodeCards(): void | Promise<void> {
	const running = cards;

	cards = undefined;

	return running?.stop();
}

/**
 * @description Checks that sample code highlights in more than one color and that the cards on screen sit on their own messages.
 * @returns The self test result for the device matrix.
 */
export async function checkCodeCards(): Promise<PluginSelfTestResult> {
	const { theme, hljs } = readPreferences();
	const tokens = await createHighlighter()
		.tokenize({ code: 'const answer: number = 42;', language: 'typescript' }, theme, hljs)
		.catch(() => null);
	const colors = new Set(tokens?.flat().map((token) => token.color)).size;
	const misplaced = (await cards?.misplaced()) ?? [];

	if (misplaced.length) {
		return {
			ok: false,
			detail: `${misplaced.length} cards are on the wrong message: ${misplaced.slice(0, 2).join('; ')}`,
		};
	}

	const { drawn, settling } = cards?.progress() ?? { drawn: 0, settling: false };

	return {
		ok: Boolean(cards) && colors > 1,
		detail: `${cards ? `${drawn} cards drawn` : 'cards not running'}, sample TypeScript in ${theme} used ${colors} colors`,
		...(drawn ? {} : { nothingDrawn: true }),
		...(settling ? { settling: true } : {}),
	};
}
