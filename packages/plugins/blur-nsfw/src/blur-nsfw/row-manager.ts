import { skipFeature } from '@unbound-plugins/shared/lifecycle/features';
import { settings } from '@unbound-app/settings';
import type { MetroFunction } from '@unbound-app/api/metro';
import { metro, patcher } from '@unbound-app/api';

import {
	rowChannelId,
	type BlurParts,
	type ChatRow,
	type RowBlurrer,
	type RowInput,
} from '~/blur-nsfw/blur';
import { byRowManager, ChannelStore } from '~/blur-nsfw/modules';
import { isNsfwChannel } from '~/blur-nsfw/nsfw';

function enabledParts(): BlurParts {
	return { attachments: settings.attachments, embeds: settings.embeds };
}

function isNsfwRow(input: RowInput | undefined, row: ChatRow | undefined): boolean {
	return isNsfwChannel(rowChannelId(input, row), (id) => ChannelStore.getChannel(id));
}

/**
 * @description Blurs the enabled parts of every chat row Discord generates in an age-restricted channel, once `RowManager` loads.
 * @param blurrer Remembers what it blurred so the rows can be put back.
 * @param onPatched Called with the handle that removes the patch, once `RowManager` is patched.
 */
export function patchRowManager(
	blurrer: RowBlurrer,
	onPatched: (unpatch: () => void) => void,
): void {
	metro.onModuleLoaded(byRowManager, (RowManager: MetroFunction) => {
		if (typeof RowManager.prototype?.generate !== 'function') {
			skipFeature('RowManager has no generate method');

			return;
		}

		onPatched(
			patcher.after(RowManager.prototype, 'generate', ({ args: [input], result }) => {
				const row = result as ChatRow | undefined;
				const parts = enabledParts();
				const blurs = parts.attachments || parts.embeds;

				blurrer.apply(row, parts, blurs && isNsfwRow(input as RowInput | undefined, row));
			}),
		);
	});
}
