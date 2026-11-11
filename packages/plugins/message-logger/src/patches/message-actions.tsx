import patchLazySheets from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { createSheetRenderer } from '@unbound-plugins/shared/action-sheets/sheet-renderer';
import {
	insertSheetRows,
	type SheetRowSpec,
} from '@unbound-plugins/shared/action-sheets/sheet-rows';
import { format, messages } from '@unbound-app/i18n';
import { patcher, toasts } from '@unbound-app/api';

import { channelHasLog, clearChannelLog, clearMessageHistory } from '~/lib/clear';
import { messageLog, type MessageLog } from '~/lib/log';
import { ActionSheets, findChatModules } from '~/lib/modules';
import { openHistorySheet } from '~/lib/sheet';

type SheetMessage = {
	id?: string;
	channel_id?: string;
	content?: string;
};

type SheetProps = {
	onClose?: () => void;
	message?: SheetMessage;
	channel?: { id?: string };
	channelId?: string;
};

function messageRows(log: MessageLog, hide: () => void, message: SheetMessage): SheetRowSpec[] {
	const { id, channel_id: channelId } = message;

	if (!id || !channelId || !log.hasHistory(id)) return [];

	const edits = log.editsOf(id);
	const specs: SheetRowSpec[] = [];

	if (edits.length) {
		specs.push({
			key: 'unbound-message-logger-history',
			label: messages.VIEW_EDIT_HISTORY,
			icon: 'ClockIcon',
			onPress() {
				hide();
				openHistorySheet(message.content ?? '', edits);
			},
		});
	}

	specs.push({
		key: 'unbound-message-logger-clear',
		label: messages.CLEAR_MESSAGE_HISTORY,
		icon: 'TrashIcon',
		onPress() {
			hide();
			clearMessageHistory(log, channelId, id);
		},
	});

	return specs;
}

function channelRows(log: MessageLog, hide: () => void, channelId: string): SheetRowSpec[] {
	if (!channelHasLog(log, channelId)) return [];

	return [
		{
			key: 'unbound-message-logger-clear-channel',
			label: messages.CLEAR_MESSAGE_LOG,
			icon: 'TrashIcon',
			onPress() {
				hide();

				const cleared = clearChannelLog(log, channelId);

				toasts.show({
					title: addon.name,
					content: format('LOG_CLEARED', { count: cleared }),
				});
			},
		},
	];
}

/**
 * @description Adds View Edit History and Clear Message History to a logged message's long-press sheet, and Clear Message Log to a channel's sheet.
 * Patches `openLazy` on Discord's action sheets (`metro.api.ActionSheets`) and the render of each message and channel sheet.
 */
export function patchMessageActions(): void {
	// `patchMessageRows` warns: the logger runs only with the rows.
	if (!findChatModules()) return;

	if (!ActionSheets) {
		logger.warn('Message history rows skipped: Discord moved ActionSheets.');

		return;
	}

	const log = messageLog;
	let specs: readonly SheetRowSpec[] = [];

	const { render } = createSheetRenderer(patcher, (result) => insertSheetRows(result, specs));

	patchLazySheets<SheetProps>(patcher, ActionSheets, (key, props) => {
		const channelId = props.channel?.id ?? props.channelId;
		const hide = () => {
			props.onClose?.();
			ActionSheets.hideActionSheet(key);
		};

		if (key.endsWith('MessageLongPressActionSheet') && props.message) {
			specs = messageRows(log, hide, props.message);
		} else if (
			/(?:Channel|Thread)(?:LongPress)?ActionSheet/i.test(key) &&
			typeof channelId === 'string'
		) {
			specs = channelRows(log, hide, channelId);
		} else {
			specs = [];
		}

		return specs.length ? render : undefined;
	});
}
