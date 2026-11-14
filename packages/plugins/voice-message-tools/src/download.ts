import type { FluxStore } from '@unbound-app/api/flux';
import type { NativeBridge } from '@unbound-app/api/native';
import { format, messages } from '@unbound-app/i18n';
import { flux, toasts } from '@unbound-app/api';

import { voiceFile, type SheetMessage } from '~/lib/voice-message';
import { saveVoiceFile } from '~/native/save';

declare module '@unbound-app/api/flux' {
	// oxlint-disable-next-line typescript/consistent-type-definitions -- merging needs an interface.
	interface FluxStores {
		Message: FluxStore & {
			getMessage(channelId: string, messageId: string): SheetMessage | undefined;
		};
	}
}

const MessageStore = flux.getStore('Message');
const SelectedChannelStore = flux.getStore('SelectedChannel');

/**
 * @description Saves the audio of a voice message in the open channel, as the pill's download button asks.
 * @param native The plugin's native bridge, for saving the file.
 * @param messageId The voice message.
 */
export async function downloadVoiceMessage(native: NativeBridge, messageId: string): Promise<void> {
	const channelId = SelectedChannelStore.getChannelId();
	const message = channelId ? MessageStore.getMessage(channelId, messageId) : undefined;
	const file = voiceFile(message);

	if (!file) {
		logger.warn(`Failed to find voice message ${messageId}:`, 'it is not in the open channel.');
		toasts.show({ title: addon.name, content: messages.DOWNLOAD_FAILED });

		return;
	}

	toasts.show({ title: addon.name, content: format('DOWNLOADING', { name: file.filename }) });

	try {
		await saveVoiceFile(native, file);
	} catch (error) {
		logger.error(`Failed to download voice message ${messageId}:`, error);
		toasts.show({ title: addon.name, content: messages.DOWNLOAD_FAILED });
	}
}
