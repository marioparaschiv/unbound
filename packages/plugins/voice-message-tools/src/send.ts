import { flux, metro, patcher } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';

import {
	showAsVoiceMessage,
	voiceMessageFlags,
	type PendingUpload,
	type ReceivedMessage,
} from '~/lib/audio';

type OutgoingMessage = { content?: string };

type SendOptions = { flags?: number; attachmentsToUpload?: PendingUpload[] };

/**
 * @description Sends a message of only audio files as a voice message. Patches `sendMessage` on Discord's message actions to
 * flag it and give its files the voice message type, length and waveform.
 */
export function patchAudioSending(): void {
	if (!settings.sendAudio) return;

	patcher.before(metro.api.Messages, 'sendMessage', ({ args }) => {
		const [, message, , options] = args as [string, OutgoingMessage?, unknown?, SendOptions?];
		const uploads = options?.attachmentsToUpload;

		if (!options || !uploads || options.flags) return;

		const flags = voiceMessageFlags(message?.content ?? '', uploads);

		if (flags) options.flags = flags;
	});
}

/**
 * @description Shows received messages whose first file is audio as voice messages. Intercepts `MESSAGE_CREATE`,
 * `MESSAGE_UPDATE` and `LOAD_MESSAGES_SUCCESS` to change each message before Discord stores it.
 */
export function interceptAudioMessages(): void {
	if (!settings.showAudio) return;

	for (const type of ['MESSAGE_CREATE', 'MESSAGE_UPDATE'] as const) {
		flux.interceptAction(type, (action) => {
			showAsVoiceMessage((action as { message?: ReceivedMessage }).message);

			return false;
		});
	}

	flux.interceptAction('LOAD_MESSAGES_SUCCESS', (action) => {
		const { messages } = action as { messages?: ReceivedMessage[] };

		if (Array.isArray(messages)) messages.forEach(showAsVoiceMessage);

		return false;
	});
}
