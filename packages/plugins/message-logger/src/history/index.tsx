import patchLazySheets from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { createSheetRenderer } from '@unbound-plugins/shared/action-sheets/sheet-renderer';
import {
	insertSheetRows,
	type SheetRowSpec,
} from '@unbound-plugins/shared/action-sheets/sheet-rows';
import { patcher, toasts } from '@unbound-app/api';

import { channelHasLog, clearChannelLog, clearMessageHistory } from '~/history/actions';
import { PLUGIN_NAME } from '~/constants';
import type { MessageLog } from '~/log';
import { ActionSheets } from '~/discord/modules';
import { closeHistorySheet, openHistorySheet } from '~/history/sheet';

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
			label: 'View Edit History',
			icon: 'ClockIcon',
			onPress() {
				hide();
				openHistorySheet(message.content ?? '', edits);
			},
		});
	}

	specs.push({
		key: 'unbound-message-logger-clear',
		label: 'Clear Message History',
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
			label: 'Clear Message Log',
			icon: 'TrashIcon',
			onPress() {
				hide();

				const cleared = clearChannelLog(log, channelId);

				toasts.show({
					title: PLUGIN_NAME,
					content: `Cleared the log of ${cleared} message${cleared === 1 ? '' : 's'}.`,
				});
			},
		},
	];
}

/**
 * @description Adds View Edit History and Clear Message History to a logged message's long-press sheet, and Clear Message Log to a channel's sheet.
 * @param log The message log.
 * @returns A function that removes the rows and ignores sheets still loading.
 */
export function patchActionSheets(log: MessageLog): () => void {
	let specs: readonly SheetRowSpec[] = [];
	const renderer = createSheetRenderer(patcher, (result) => insertSheetRows(result, specs));

	const unpatch = patchLazySheets<SheetProps>(patcher, ActionSheets, (key, props) => {
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

		return specs.length ? renderer.render : undefined;
	});

	return () => {
		unpatch();
		renderer.dispose();
		closeHistorySheet();
	};
}

export default patchActionSheets;
