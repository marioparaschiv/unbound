import { recordSkip } from '@unbound-plugins/shared/lifecycle/health';
import { settings } from '@unbound-app/settings';
import { patcher } from '@unbound-app/api';

import {
	rowChannelId,
	type BlurParts,
	type ChatRow,
	type RowBlurrer,
	type RowInput,
} from '~/blur-nsfw/blur';
import { ChannelStore, RowManager } from '~/blur-nsfw/modules';
import { isNsfwChannel } from '~/blur-nsfw/nsfw';
import { PLUGIN_NAME } from '~/constants';

function enabledParts(): BlurParts {
	return { attachments: settings.attachments, embeds: settings.embeds };
}

function isNsfwRow(input: RowInput | undefined, row: ChatRow | undefined): boolean {
	return isNsfwChannel(rowChannelId(input, row), (id) => ChannelStore.getChannel(id));
}

/**
 * @description Blurs the enabled parts of every chat row Discord generates in an age-restricted channel.
 * @param blurrer Remembers what it blurred so the rows can be put back.
 * @returns `true` when the patch is applied, `false` when `RowManager` has no `generate`.
 */
export function patchRowManager(blurrer: RowBlurrer): boolean {
	if (typeof RowManager.prototype?.generate !== 'function') {
		const reason = 'RowManager has no generate method';

		console.error(`[${PLUGIN_NAME}] Skipped, ${reason}.`);
		recordSkip(reason);

		return false;
	}

	patcher.after(RowManager.prototype, 'generate', ({ args: [input], result }) => {
		const row = result as ChatRow | undefined;
		const parts = enabledParts();
		const blurs = parts.attachments || parts.embeds;

		blurrer.apply(row, parts, blurs && isNsfwRow(input as RowInput | undefined, row));
	});

	return true;
}
