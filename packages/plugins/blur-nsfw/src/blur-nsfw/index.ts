import { recordApplied } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import { ChannelStore, RowManager } from '~/blur-nsfw/modules';
import { patchRowManager } from '~/blur-nsfw/row-manager';
import { RowBlurrer } from '~/blur-nsfw/blur';
import { PLUGIN_NAME } from '~/constants';

const blurrer = new RowBlurrer();

/**
 * @description Blurs attachments and embeds in age-restricted channels.
 * Patches `generate` on `RowManager`'s prototype and reads channels from `ChannelStore`.
 * The Addon scope removes the patch when the plugin stops.
 */
export function startBlurNsfw(): void {
	if (!ensureModules(PLUGIN_NAME, { ChannelStore, RowManager })) return;

	if (patchRowManager(blurrer)) recordApplied(1);
}

/**
 * @description Puts back every chat row the plugin still has blurred, which the Addon scope cannot see.
 */
export function stopBlurNsfw(): void {
	blurrer.restoreAll();
}
