import { metro, toasts } from '@unbound-app/api';
import { definePlatform } from '@unbound-app/api/native';
import { messages } from '@unbound-app/i18n';

import TimestampStylesSheet from '~/components/timestamp-styles-sheet';
import { pickMoment as android } from '~/lib/android/pick-moment';
import { pickMoment as ios } from '~/lib/ios/pick-moment';

const STYLES_SHEET_KEY = 'unbound-send-timestamps-styles';

const pickMoment = definePlatform({ ios, android });

type ChatInput = { insertText?: (text: string) => void };

function insert(channelId: string, markup: string): void {
	const input: ChatInput | null | undefined = metro
		.findByProps('getBestActiveInputForChannelId')
		?.getBestActiveInputForChannelId?.(channelId);

	metro.api.ActionSheets.hideActionSheet(STYLES_SHEET_KEY);

	if (typeof input?.insertText !== 'function') {
		logger.warn(`Failed to insert a timestamp in channel ${channelId}: no chat input.`);

		return;
	}

	input.insertText(`${markup} `);
}

function copy(markup: string): void {
	metro.common.Clipboard.setString(markup);
	toasts.show({ title: messages.PICKER_NAME, content: messages.COPIED });
}

function openStyles(channelId: string, moment: Date): void {
	metro.api.ActionSheets.openLazy(
		Promise.resolve({
			default: () => (
				<TimestampStylesSheet
					moment={moment}
					onInsert={(markup) => insert(channelId, markup)}
					onCopy={copy}
					onChangeTime={() => {
						metro.api.ActionSheets.hideActionSheet(STYLES_SHEET_KEY);
						openTimestampPicker(channelId, moment);
					}}
				/>
			),
		}),
		STYLES_SHEET_KEY,
	);
}

/**
 * @description Asks for a date and time with Discord's own picker, then for the style to insert it in.
 * @param channelId The channel whose chat input gets the timestamp.
 * @param start The moment the picker starts on.
 */
export function openTimestampPicker(channelId: string, start: Date = new Date()): void {
	pickMoment(start, (moment) => openStyles(channelId, moment));
}
