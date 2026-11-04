import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import type { PluginContext } from '@unbound-app/api/native';

import { MessageStore, SelectedChannelStore } from '~/codeblocks/modules';
import { createHighlighter } from '~/codeblocks/highlighter';
import { readPreferences } from '~/codeblocks/preferences';
import { startCards } from '~/codeblocks/platform';
import { PLUGIN_NAME } from '~/constants';
import type { Cards } from '~/types';

let dispose: () => Promise<void> | undefined = () => undefined;
let cards: Cards | undefined;

/**
 * @description Draws syntax-highlighted code cards in place of code blocks in messages, natively on iOS and Android.
 * Reads `MessageStore` and `SelectedChannelStore`, and hooks Discord's native message cells and text views through
 * the platform handler. The native hooks are outside the Addon scope, so `stopCodeblocks` removes them.
 * @param context The plugin context, whose native bridge and granted capabilities the cards need.
 */
export function startCodeblocks(context: PluginContext): void {
	if (
		!ensureCapabilities(PLUGIN_NAME, context.native, context.capabilities) ||
		!ensureModules(PLUGIN_NAME, { MessageStore, SelectedChannelStore })
	) {
		return;
	}

	cards = startCards(context.native);

	if (cards) {
		dispose = applyFeatures(PLUGIN_NAME, [cards.feature]);
	}
}

/**
 * @description Removes the native hooks and views the cards added.
 * @returns A promise while a removal is still finishing.
 */
export function stopCodeblocks(): Promise<void> | undefined {
	const finished = dispose();

	dispose = () => undefined;
	cards = undefined;

	return finished;
}

/**
 * @description Checks that sample code highlights in more than one color and that the cards on screen sit on their own messages.
 * @returns The self test result for the device matrix.
 */
export async function codeblocksSelfTest() {
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
