import type { NativeBridge } from '@unbound-app/api/native';
import { metro, patcher } from '@unbound-app/api';

import coverage from '~/lib/coverage.json';
import { swapMarkupEmoji, type Markup } from '~/lib/markup';
import { coverageSets, packUrl, type PackId } from '~/lib/packs';

const MARKUP_PARSERS = 'modules/messages/native/renderer/MarkupParsers.tsx';
const PARSERS = [
	'parseMessageMarkup',
	'parseEmbedTitleMarkup',
	'parseEmbedTitleMarkupWithoutLinks',
	'parseEmbedDescriptionMarkup',
] as const;

type MarkupParsers = Record<(typeof PARSERS)[number], (...args: unknown[]) => Markup>;

/**
 * @description Draws unicode emoji from a pack on iOS. Discord's native chat draws custom emoji from their `src`, so
 * the patched markup parsers hand it each covered emoji as a custom emoji with the pack's image.
 * @param _native The plugin's native bridge, unused: the swap happens in the parsed markup.
 * @param pack Reads the chosen pack.
 * @returns `refresh`, which does nothing since each parse reads the pack, and `dispose`, which removes the patches.
 */
export function packsIOS(_native: NativeBridge, pack: () => PackId) {
	const sets = coverageSets(coverage);
	const imageFor = (surrogates: string) => packUrl(pack(), surrogates, sets);
	const Parsers = metro.findByFilePath(MARKUP_PARSERS) as MarkupParsers | undefined;
	const unpatches = PARSERS.filter((name) => typeof Parsers?.[name] === 'function').map((name) =>
		patcher.after(Parsers!, name, ({ result }) => swapMarkupEmoji(result, imageFor)),
	);

	if (unpatches.length === 0) logger.warn('Emoji packs skipped: Discord moved MarkupParsers.');

	return {
		refresh() {},
		dispose() {
			for (const unpatch of unpatches) unpatch();
		},
	};
}
