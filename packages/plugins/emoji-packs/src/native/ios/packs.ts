import type { NativeBridge } from '@unbound-app/api/native';
import { metro, patcher } from '@unbound-app/api';

import coverage from '~/lib/coverage.json';
import { swapMarkupEmoji, type Markup } from '~/lib/markup';
import { coverageSets } from '~/lib/coverage-sets';
import { packUrl, type PackId } from '~/lib/packs';
import { feedComposerImages } from '~/lib/composer-images';
import {
	installComposerPack,
	restoreComposerPack,
	setComposerPack,
	takeComposerImages,
} from '~/native/ios/composer';

const MARKUP_PARSERS = 'modules/messages/native/renderer/MarkupParsers.tsx';
const PARSERS = [
	'parseMessageMarkup',
	'parseEmbedTitleMarkup',
	'parseEmbedTitleMarkupWithoutLinks',
	'parseEmbedDescriptionMarkup',
] as const;

type PickerEmoji = { id?: string | null; surrogates?: string };
type PickerUrlModule = { default: (emoji: PickerEmoji, animated: boolean, size: number) => string };
type MarkupParsers = Record<(typeof PARSERS)[number], (...args: unknown[]) => Markup>;

/**
 * @description Draws unicode emoji from a pack on iOS. Discord's native chat draws custom emoji from their `src`, so
 * the patched markup parsers hand it each covered emoji as a custom emoji with the pack's image; the emoji picker
 * reads each emoji's image from `getEmojiItemUrl`, which answers with the pack's image; the composer gets image overlays.
 * @param native The plugin's native bridge, which draws the composer's emoji.
 * @param pack Reads the chosen pack.
 * @returns `refresh`, which tells the composer the new pack, and `dispose`, which removes the patches and overlays.
 */
export function packsIOS(native: NativeBridge, pack: () => PackId) {
	const sets = coverageSets(coverage);
	const imageFor = (surrogates: string) => packUrl(pack(), surrogates, sets);
	const Parsers = metro.findByFilePath(MARKUP_PARSERS) as MarkupParsers | undefined;
	const unpatches = PARSERS.filter((name) => typeof Parsers?.[name] === 'function').map((name) =>
		patcher.after(Parsers!, name, ({ result }) => swapMarkupEmoji(result, imageFor)),
	);

	if (unpatches.length === 0) logger.warn('Emoji packs skipped: Discord moved MarkupParsers.');

	const PickerUrl = metro.findByName('getEmojiItemUrl', { interop: false }) as
		| PickerUrlModule
		| undefined;

	if (PickerUrl && typeof PickerUrl.default === 'function') {
		unpatches.push(
			patcher.after(PickerUrl, 'default', ({ args: [emoji], result }) =>
				!emoji?.id && emoji?.surrogates ? (imageFor(emoji.surrogates) ?? result) : result,
			),
		);
	} else {
		logger.warn('Emoji picker keeps Discord’s emoji: Discord moved getEmojiItemUrl.');
	}

	const scope = native.ui.createScope();

	native.ui.run(installComposerPack, scope, pack(), coverage);

	const stopFeeding = feedComposerImages((files) => native.ui.call(takeComposerImages, files));

	return {
		refresh() {
			native.ui.run(setComposerPack, pack());
		},
		dispose() {
			for (const unpatch of unpatches) unpatch();

			stopFeeding();
			native.ui.run(restoreComposerPack);
			scope.dispose();
		},
	};
}
