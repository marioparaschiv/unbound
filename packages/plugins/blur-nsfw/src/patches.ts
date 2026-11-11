import { settings } from '@unbound-app/settings';
import type { MetroFunction } from '@unbound-app/api/metro';
import { flux, metro, patcher } from '@unbound-app/api';

import { blurredRows, rowChannelId, type BlurParts, type ChatRow, type RowInput } from '~/lib/blur';
import { isNsfwChannel, type ChannelLike } from '~/lib/nsfw';

type ChannelStoreType = {
	getChannel(id: string): ChannelLike | undefined;
};

const ChannelStore = flux.getStore('Channel') as unknown as ChannelStoreType;

function enabledParts(): BlurParts {
	return { attachments: settings.attachments, embeds: settings.embeds };
}

function isNsfwRow(input: RowInput | undefined, row: ChatRow | undefined): boolean {
	return isNsfwChannel(rowChannelId(input, row), (id) => ChannelStore.getChannel(id));
}

/**
 * @description Blurs the enabled parts of every chat row Discord generates in an age-restricted channel, by patching
 * `generate` on `RowManager`'s prototype once `RowManager` loads. `stop` puts the blurred rows back.
 */
export function patchRowManager(): void {
	metro.onModuleLoaded(
		metro.filters.byName('RowManager'),
		(RowManager: MetroFunction) => {
			if (typeof RowManager.prototype?.generate !== 'function') {
				logger.warn('Blur skipped: Discord moved RowManager.generate.');

				return;
			}

			patcher.after(RowManager.prototype, 'generate', ({ args: [input], result }) => {
				const row = result as ChatRow | undefined;
				const parts = enabledParts();
				const blurs = parts.attachments || parts.embeds;

				blurredRows.apply(
					row,
					parts,
					blurs && isNsfwRow(input as RowInput | undefined, row),
				);
			});
		},
		{ onMissing: () => logger.warn('Blur skipped: Discord moved RowManager.') },
	);
}
