import patchLazySheets from '@unbound-plugins/shared/action-sheets/patch-lazy-sheets';
import { createSheetRenderer } from '@unbound-plugins/shared/action-sheets/sheet-renderer';
import {
	insertSheetRows,
	type SheetRowSpec,
} from '@unbound-plugins/shared/action-sheets/sheet-rows';
import { patcher, toasts } from '@unbound-app/api';

import { canAddAttachments, remainingAttachments } from '~/uploads/eligibility';
import { ActionSheets, UserStore } from '~/discord/modules';
import { canAttachIn } from '~/uploads/permissions';
import { pickAttachments } from '~/uploads/picker';
import { addAttachments } from '~/uploads';
import type { EditableMessage } from '~/types';
import { PLUGIN_NAME } from '~/constants';

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
			title: PLUGIN_NAME,
			content: error instanceof Error ? error.message : 'The media picker failed.',
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
			label: 'Add Attachments',
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
 * @returns A function that removes the row and ignores sheets still loading.
 */
export function patchActionSheets(): () => void {
	let specs: readonly SheetRowSpec[] = [];
	const renderer = createSheetRenderer(patcher, (result) => insertSheetRows(result, specs));

	const unpatch = patchLazySheets<SheetProps>(patcher, ActionSheets, (key, props) => {
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

	return () => {
		unpatch();
		renderer.dispose();
	};
}

export default patchActionSheets;
