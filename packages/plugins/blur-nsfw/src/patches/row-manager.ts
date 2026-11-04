import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import { recordSkip } from '@unbound-plugins/shared/lifecycle/health';
import type { MetroFunction } from '@unbound-app/api/metro';
import { patcher } from '@unbound-app/api';

import { RowBlurrer, rowChannelId, type BlurParts, type ChatRow, type RowInput } from '~/blur';
import { PLUGIN_NAME, SETTINGS, type BlurPart } from '~/constants';
import { byRowManager, ChannelStore, settings } from '~/modules';
import { isNsfwChannel } from '~/nsfw';

function enabledParts(): BlurParts {
	const parts = {} as BlurParts;

	for (const part of Object.keys(SETTINGS) as BlurPart[]) {
		parts[part] = settings.get(part, SETTINGS[part]) === true;
	}

	return parts;
}

function isNsfwRow(input: RowInput | undefined, row: ChatRow | undefined): boolean {
	return isNsfwChannel(rowChannelId(input, row), (id) => ChannelStore.getChannel(id));
}

/**
 * @description Blurs the enabled parts of every chat row Discord generates in an age-restricted channel, once `RowManager` loads, and restores rows Discord reuses after a part is turned off.
 * @returns A function that stops waiting for `RowManager`, removes the patch and puts back every row still blurred.
 */
export function patchRowManager(): () => void {
	const blurrer = new RowBlurrer();

	const unpatch = whenLoaded(byRowManager, (RowManager: MetroFunction) => {
		if (typeof RowManager.prototype?.generate !== 'function') {
			const reason = 'RowManager has no generate method';

			console.error(`[${PLUGIN_NAME}] Skipped, ${reason}.`);
			recordSkip(reason);

			return;
		}

		return patcher.after(RowManager.prototype, 'generate', ({ args: [input], result }) => {
			const row = result as ChatRow | undefined;
			const parts = enabledParts();
			const blurs = parts.attachments || parts.embeds;

			blurrer.apply(row, parts, blurs && isNsfwRow(input as RowInput | undefined, row));
		});
	});

	return () => {
		unpatch();
		blurrer.restoreAll();
	};
}

export default patchRowManager;
