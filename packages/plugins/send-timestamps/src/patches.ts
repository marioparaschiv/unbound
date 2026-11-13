import { metro, patcher } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';
import { settings } from '@unbound-app/settings';
import { patchChatInputButton } from '@unbound-plugins/shared/composer/input-button';

import { openTimestampPicker } from '~/lib/picker';
import { replaceTimes } from '~/lib/timestamps';

type Message = { content: string };

function isMessage(argument: unknown): argument is Message {
	return typeof (argument as Partial<Message> | undefined)?.content === 'string';
}

/**
 * @description Turns times wrapped in backticks into timestamps in each message the user sends.
 * Patches `sendMessage` on Discord's message actions.
 */
export function patchSentTimes(): void {
	if (!settings.replace) return;

	const Messages = metro.api.Messages;

	if (typeof Messages?.sendMessage !== 'function') {
		logger.warn('Message times skipped: Discord moved Messages.');

		return;
	}

	patcher.before(Messages, 'sendMessage', ({ args }) => {
		const message = args.find(isMessage);

		if (message) message.content = replaceTimes(message.content);
	});
}

/**
 * @description Adds a clock button to the chat input that picks a date, time and style and inserts the timestamp.
 */
export function patchPickerButton(): void {
	if (!settings.pickerButton) return;

	patchChatInputButton({
		key: 'unbound-send-timestamps-picker',
		name: 'Timestamp picker',
		icon: 'ClockIcon',
		label: () => messages.PICKER_BUTTON,
		onPress: (channelId) => openTimestampPicker(channelId),
	});
}
