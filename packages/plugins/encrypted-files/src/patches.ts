import patchLazySheets from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { insertSheetRows } from '@unbound-plugins/shared/action-sheets/sheet-rows';
import { patchChatInputButton } from '@unbound-plugins/shared/composer/input-button';
import type { NativeBridge } from '@unbound-app/api/native';
import { metro, patcher, toasts } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';

import { encryptsIn, saveContactKey, setEncryptsIn } from '~/lib/keys';
import { fingerprint, readKeyText } from '~/lib/key-text';
import { openDecryptSheet } from '~/components/decrypt-sheet';

const SHEET_SWAP_MS = 350;
const ENCRYPTED = /\.ufx$/i;

type Attachment = { url?: string; filename?: string };

type SheetProps = {
	message?: {
		id?: string;
		content?: string;
		author?: { id?: string };
		attachments?: Attachment[];
	};
};

/**
 * @description Adds a lock button to the chat input that turns encryption of new files on for that channel.
 */
export function patchComposer(): void {
	patchChatInputButton({
		key: 'unbound-encrypted-files',
		name: 'Encrypted Files',
		icon: 'ShieldUserIcon',
		label: () => messages.TOGGLE,
		showWhenEmpty: true,
		onPress: (channelId) => {
			const on = !encryptsIn(channelId);

			setEncryptsIn(channelId, on);
			toasts.info(on ? 'ENCRYPTION_ON' : 'ENCRYPTION_OFF');
		},
	});
}

/**
 * @description Adds Save Encryption Key to messages that share a key, and Decrypt File to messages with an encrypted
 * attachment, in the message long-press sheet.
 * @param bridge The plugin's native bridge.
 */
export function patchActionSheets(bridge: NativeBridge): void {
	const { ActionSheets } = metro.api;

	if (!ActionSheets) {
		logger.warn('Encrypted Files rows skipped: Discord moved ActionSheets.');

		return;
	}

	patchLazySheets<SheetProps>(patcher, ActionSheets, (key, props) => {
		const { content, author, attachments } = props.message ?? {};
		const sharedKey = readKeyText(content);
		const encrypted = (attachments ?? []).find(
			({ filename, url }) => url && ENCRYPTED.test(filename ?? ''),
		);

		if (!key.endsWith('MessageLongPressActionSheet') || (!sharedKey && !encrypted)) return;

		return (result) => {
			insertSheetRows(result, [
				...(sharedKey && author?.id
					? [
							{
								key: 'unbound-encrypted-files-save-key',
								label: messages.SAVE_KEY,
								icon: 'ShieldUserIcon',
								onPress: () => {
									ActionSheets.hideActionSheet(key);
									saveContactKey(author.id!, sharedKey);
									toasts.success('KEY_SAVED', {
										fingerprint: fingerprint(sharedKey),
									});
								},
							},
						]
					: []),
				...(encrypted
					? [
							{
								key: 'unbound-encrypted-files-decrypt',
								label: messages.DECRYPT,
								icon: 'ShieldUserIcon',
								onPress: () => {
									ActionSheets.hideActionSheet(key);
									setTimeout(
										() => openDecryptSheet({ url: encrypted.url!, bridge }),
										SHEET_SWAP_MS,
									);
								},
							},
						]
					: []),
			]);

			return result;
		};
	});
}
