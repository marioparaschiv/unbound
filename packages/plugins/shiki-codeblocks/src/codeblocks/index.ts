import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import type { Feature, SelfTestResult } from '@unbound-plugins/shared/lifecycle/features';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import type { PluginContext } from '@unbound-app/api/native';

import { MessageStore, SelectedChannelStore } from '~/codeblocks/modules';
import { createHighlighter } from '~/codeblocks/highlighter';
import { readPreferences } from '~/codeblocks/preferences';
import { startCards } from '~/codeblocks/platform';
import type { Cards } from '~/types';

let cards: Cards | undefined;

/**
 * @description Draws syntax-highlighted code cards in place of code blocks in messages, natively on iOS and Android.
 * Reads `MessageStore` and `SelectedChannelStore`, and hooks Discord's native message cells and text views through
 * the platform handler. The native hooks are outside the Addon scope, so `stop` removes them.
 * @param context The plugin context, whose native bridge and granted capabilities the cards need.
 * @returns The features, which start together; `undefined` when the plugin skipped starting.
 */
export function startCodeblocks(context: PluginContext): Feature[] | undefined {
	if (
		!ensureCapabilities(context.native, context.capabilities) ||
		!ensureModules({ MessageStore, SelectedChannelStore })
	) {
		return;
	}

	const started = startCards(context.native);

	if (!started) return;

	return [
		() => {
			cards = started;

			return () => {
				cards = undefined;
			};
		},
		started.feature,
	];
}

/**
 * @description Checks that sample code highlights in more than one color and that the cards on screen sit on their own messages.
 * @param features The features' own result, which a failure keeps.
 * @returns The self test result for the device matrix.
 */
export async function codeblocksSelfTest(features: SelfTestResult): Promise<SelfTestResult> {
	if (!features.ok) return features;

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
