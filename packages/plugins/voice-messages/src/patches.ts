import patchLazySheets from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { insertSheetRows } from '@unbound-plugins/shared/action-sheets/sheet-rows';
import type { NativeBridge } from '@unbound-app/api/native';
import { format, messages } from '@unbound-app/i18n';
import { metro, patcher, toasts } from '@unbound-app/api';

import { voiceFile, type SheetMessage, type VoiceFile } from '~/lib/voice-message';
import { saveVoiceFile } from '~/native/save';

async function download(native: NativeBridge, file: VoiceFile): Promise<void> {
	toasts.show({ title: addon.name, content: format('DOWNLOADING', { name: file.filename }) });

	try {
		await saveVoiceFile(native, file);
	} catch (error) {
		logger.error(`Failed to download voice message ${file.filename}:`, error);
		toasts.show({ title: addon.name, content: messages.DOWNLOAD_FAILED });
	}
}

/**
 * @description Adds a Download Voice Message row to the long-press sheet of voice messages. Patches the message long-press
 * sheet through `patchLazySheets`.
 * @param native The plugin's native bridge, for saving the file.
 */
export function patchMessageSheet(native: NativeBridge): void {
	const { ActionSheets } = metro.api;

	if (!ActionSheets) {
		logger.warn('Voice message download skipped: Discord moved ActionSheets.');

		return;
	}

	patchLazySheets<{ message?: SheetMessage }>(patcher, ActionSheets, (key, props) => {
		const file = key.endsWith('MessageLongPressActionSheet')
			? voiceFile(props.message)
			: undefined;

		if (!file) return;

		return (result) => {
			insertSheetRows(result, [
				{
					key: 'unbound-voice-message-download',
					label: messages.DOWNLOAD,
					icon: 'DownloadIcon',
					onPress: () => {
						ActionSheets.hideActionSheet(key);
						void download(native, file);
					},
				},
			]);

			return result;
		};
	});
}
