import patchLazySheets from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { createSheetRenderer } from '@unbound-plugins/shared/action-sheets/sheet-renderer';
import {
	insertSheetRows,
	type SheetRowSpec,
} from '@unbound-plugins/shared/action-sheets/sheet-rows';
import { flux, metro, patcher, toasts } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';

import { canAddAttachments, remainingAttachments } from '~/lib/eligibility';
import { CloudUploader, REST } from '~/lib/modules';
import { canAttachIn } from '~/lib/permissions';
import { pickAttachments } from '~/lib/picker';
import { addAttachments } from '~/lib/uploads';
import type { EditableMessage } from '~/lib/types';

const UserStore = flux.getStore('User');

type SheetProps = {
	message?: EditableMessage;
	onClose?: () => void;
};

async function chooseAndAdd(message: EditableMessage): Promise<void> {
	try {
		const items = await pickAttachments(remainingAttachments(message));

		await addAttachments(message.channel_id, message.id, items);
	} catch (error) {
		toasts.show({
			title: addon.name,
			content: error instanceof Error ? error.message : messages.PICKER_FAILED,
		});
	}
}

function rowsFor(message: EditableMessage, hide: () => void): SheetRowSpec[] {
	if (
		!canAddAttachments(message, UserStore.getCurrentUser?.()?.id) ||
		!canAttachIn(message.channel_id)
	) {
		return [];
	}

	return [
		{
			key: 'unbound-add-attachments',
			label: messages.ADD_ATTACHMENTS,
			icon: 'ImagePlusIcon',
			onPress() {
				hide();
				void chooseAndAdd(message);
			},
		},
	];
}

/**
 * @description Adds an Add Attachments row to the long-press menu of your own messages, which opens the photo and video picker.
 * Patches the message long-press sheet through `patchLazySheets`.
 */
export function patchMessageLongPressSheet(): void {
	const { ActionSheets } = metro.api;

	if (!ActionSheets || !CloudUploader || !REST) {
		logger.warn('Sheet skipped: Discord moved ActionSheets, CloudUploader or REST.');

		return;
	}

	let specs: readonly SheetRowSpec[] = [];
	const renderer = createSheetRenderer(patcher, (result) => insertSheetRows(result, specs));

	patchLazySheets<SheetProps>(patcher, ActionSheets, (key, props) => {
		if (!key.endsWith('MessageLongPressActionSheet') || !props.message) {
			specs = [];

			return undefined;
		}

		specs = rowsFor(props.message, () => {
			props.onClose?.();
			ActionSheets.hideActionSheet(key);
		});

		return specs.length ? renderer.render : undefined;
	});
}
