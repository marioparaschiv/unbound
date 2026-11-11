import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { ChannelStore } from '~/blur-nsfw/modules';
import { patchRowManager } from '~/blur-nsfw/row-manager';
import { RowBlurrer } from '~/blur-nsfw/blur';

/**
 * @description Blurs attachments and embeds in age-restricted channels.
 * Patches `generate` on `RowManager`'s prototype once `RowManager` loads, and reads channels from `ChannelStore`.
 * @returns A function that removes the row patch, then puts back every chat row the plugin still has blurred; the patch
 * goes first so a row Discord generates while restoring is not blurred again.
 */
export function startBlurNsfw(): (() => void) | undefined {
	if (!ensureModules({ ChannelStore })) return;

	const blurrer = new RowBlurrer();
	const unpatches: (() => void)[] = [];

	patchRowManager(blurrer, (unpatch) => unpatches.push(unpatch));

	return () => {
		for (const unpatch of unpatches.splice(0)) unpatch();

		blurrer.restoreAll();
	};
}
