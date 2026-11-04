import { recordApplied } from '@unbound-plugins/shared/lifecycle/health';
import patchLazySheets from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { createSheetRenderer } from '@unbound-plugins/shared/action-sheets/sheet-renderer';
import {
	insertSheetRows,
	type SheetRowSpec,
} from '@unbound-plugins/shared/action-sheets/sheet-rows';
import { format, messages } from '@unbound-app/i18n';
import { patcher, toasts } from '@unbound-app/api';

import { channelHasLog, clearChannelLog, clearMessageHistory } from '~/history/actions';
import { PLUGIN_NAME } from '~/constants';
import type { MessageLog } from '~/log';
import { ActionSheets } from '~/history/modules';
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
					title: PLUGIN_NAME,
					content: format('LOG_CLEARED', { count: cleared }),
				});
			},
		},
	];
}

let stopSheets: (() => void) | undefined;
let renderer: ReturnType<typeof createSheetRenderer> | undefined;

/**
 * @description Adds View Edit History and Clear Message History to a logged message's long-press sheet, and Clear Message Log to a channel's sheet.
 * Patches `openLazy` on Discord's action sheets (`metro.api.ActionSheets`) and the render of each message and channel sheet.
 * @param log The message log.
 */
export function startHistory(log: MessageLog): void {
	let specs: readonly SheetRowSpec[] = [];

	renderer = createSheetRenderer(patcher, (result) => insertSheetRows(result, specs));

	const { render } = renderer;

	stopSheets = patchLazySheets<SheetProps>(patcher, ActionSheets, (key, props) => {
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

	recordApplied(1);
}

/**
 * @description Ignores sheets that are still loading, unwraps the rendered rows and closes the history sheet, which the Addon scope can't see.
 */
export function stopHistory(): void {
	stopSheets?.();
	stopSheets = undefined;
	renderer?.dispose();
	renderer = undefined;
	closeHistorySheet();
}
