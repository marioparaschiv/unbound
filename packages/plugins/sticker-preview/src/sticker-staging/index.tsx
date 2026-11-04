import { recordApplied } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';

import {
	ChatInputSendButton,
	ChatInputs,
	FloatingChatInputContainer,
	MessageActions,
	StickerModule,
	StickerPickerListRow,
} from '~/sticker-staging/modules';
import { patchFloatingChatInputContainer } from '~/sticker-staging/composer-preview';
import { patchStickerPickerListRow } from '~/sticker-staging/picker-row';
import { patchChatInputSendButton } from '~/sticker-staging/send-button';
import { createStaging, type Staging } from '~/sticker-staging/staging';

let staging: Staging | undefined;

/**
 * @description Stages picked stickers in the composer with a preview, and sends them with the message.
 * Patches the renders of `StickerPickerListRow`, `ChatInputSendButton` and `FloatingChatInputContainer`,
 * draws the preview with `Sticker`, and sends through `ChatInputs` and the message actions.
 * The Addon scope removes the patches, but the hooks put on Discord's inputs and send buttons need `stopStickerStaging`.
 */
export function startStickerStaging(): void {
	if (
		!ensureModules('Sticker Preview', {
			ChatInputs,
			MessageActions,
			StickerModule,
			StickerPickerListRow,
			ChatInputSendButton,
			FloatingChatInputContainer,
		})
	) {
		return;
	}

	staging = createStaging();

	patchStickerPickerListRow(staging);
	patchChatInputSendButton(staging);
	patchFloatingChatInputContainer(staging);
	recordApplied(3);
}

/**
 * @description Clears every staged sticker and puts back the send handlers and send buttons the plugin hooked.
 */
export function stopStickerStaging(): void {
	staging?.dispose();
	staging = undefined;
}
