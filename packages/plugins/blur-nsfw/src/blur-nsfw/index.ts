import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { ChannelStore } from '~/blur-nsfw/modules';
import { patchRowManager } from '~/blur-nsfw/row-manager';
import { RowBlurrer } from '~/blur-nsfw/blur';
import { PLUGIN_NAME } from '~/constants';

const blurrer = new RowBlurrer();
const unpatches: (() => void)[] = [];

/**
 * @description Blurs attachments and embeds in age-restricted channels.
 * Patches `generate` on `RowManager`'s prototype once `RowManager` loads, and reads channels from `ChannelStore`.
 * The Addon scope removes the patch when the plugin stops.
 */
export function startBlurNsfw(): void {
	if (!ensureModules(PLUGIN_NAME, { ChannelStore })) return;

	patchRowManager(blurrer, (unpatch) => unpatches.push(unpatch));
}

/**
 * @description Removes the row patch, then puts back every chat row the plugin still has blurred.
 * The patch goes first so a row Discord generates while restoring is not blurred again.
 */
export function stopBlurNsfw(): void {
	for (const unpatch of unpatches.splice(0)) unpatch();

	blurrer.restoreAll();
}
