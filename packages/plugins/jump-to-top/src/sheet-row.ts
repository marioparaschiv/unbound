import { patchLazySheets } from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { createSheetRenderer } from '@unbound-plugins/shared/action-sheets/sheet-renderer';
import { insertSheetRows } from '@unbound-plugins/shared/action-sheets/sheet-rows';
import { metro, patcher } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';

import { jumpToTop } from '~/lib/jump';
import { sheetChannelId } from '~/lib/sheet-channel';

const ROW_KEY = 'unbound-jump-to-top';

let open: { key: string; channelId: string } | null = null;

function openAtTop(channelId: string): void {
	metro.findByProps('transitionToChannel')?.transitionToChannel(channelId);
	setTimeout(() => void jumpToTop(channelId), 300);
}

/**
 * @description Adds a Jump to top row to the long-press sheets of channels, threads and forum posts, which opens the channel at
 * its first message. Patches the sheets Discord opens through `openLazy` on its action sheets module, via `patchLazySheets`.
 */
export function patchChannelSheets(): void {
	const { ActionSheets } = metro.api;

	if (!ActionSheets) {
		logger.warn('Jump to top row skipped: Discord moved ActionSheets.');

		return;
	}

	const renderer = createSheetRenderer(patcher, (result) => {
		if (!open) return;

		const { key, channelId } = open;

		insertSheetRows(result, [
			{
				key: ROW_KEY,
				label: messages.JUMP_TO_TOP,
				icon: 'ArrowLargeUpIcon',
				onPress: () => {
					ActionSheets.hideActionSheet(key);
					ActionSheets.hideAllActionSheets?.();
					openAtTop(channelId);
				},
			},
		]);
	});

	patchLazySheets(patcher, ActionSheets, (key, props) => {
		const channelId = sheetChannelId(key, props as Parameters<typeof sheetChannelId>[1]);

		open = channelId ? { key, channelId } : null;

		return open ? renderer.render : undefined;
	});
}
