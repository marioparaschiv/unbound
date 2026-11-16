import patchLazySheets from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { insertSheetRows } from '@unbound-plugins/shared/action-sheets/sheet-rows';
import type { NativeBridge } from '@unbound-app/api/native';
import { flux, metro, patcher, toasts } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';
import { messages } from '@unbound-app/i18n';

import { screenshotMessages } from '~/native/screenshot';
import { pickMessages, type ChannelMessage } from '~/lib/pick';

type SheetProps = { message?: { id?: string; channel_id?: string } };

type MessageStore = { getMessages(channelId: string): { toArray(): ChannelMessage[] } };

const SHEET_CLOSE_MS = 400;

async function takeScreenshot(native: NativeBridge, channelId: string, messageId: string) {
	const Messages = flux.getStore('Message') as unknown as MessageStore;
	const ids = pickMessages(Messages.getMessages(channelId).toArray(), messageId, settings.count);

	try {
		await new Promise((resolve) => setTimeout(resolve, SHEET_CLOSE_MS));

		const result = await screenshotMessages(native, ids, settings.output);

		if (result === 'not-visible') {
			toasts.show({ title: addon.name, content: messages.NOT_VISIBLE });
		} else if (settings.output === 'copy') {
			toasts.show({ title: addon.name, content: messages.COPIED, icon: 'CopyIcon' });
		}
	} catch (error) {
		logger.error(`Failed to screenshot message ${messageId}:`, error);
		toasts.show({ title: addon.name, content: messages.FAILED });
	}
}

/**
 * @description Adds a Screenshot row to the message long-press action sheet.
 * @param native The plugin's native bridge.
 */
export function patchActionSheets(native: NativeBridge): void {
	const { ActionSheets } = metro.api;

	if (!ActionSheets) {
		logger.warn('Message screenshot skipped: Discord moved ActionSheets.');

		return;
	}

	patchLazySheets<SheetProps>(patcher, ActionSheets, (key, props) => {
		const { id: messageId, channel_id: channelId } = props.message ?? {};

		if (!key.endsWith('MessageLongPressActionSheet') || !messageId || !channelId) return;

		return (result) => {
			insertSheetRows(result, [
				{
					key: 'unbound-message-screenshot',
					label: messages.SCREENSHOT,
					icon: 'ImageIcon',
					onPress: () => {
						ActionSheets.hideActionSheet(key);
						void takeScreenshot(native, channelId, messageId);
					},
				},
			]);

			return result;
		};
	});
}

export default { patchActionSheets };
