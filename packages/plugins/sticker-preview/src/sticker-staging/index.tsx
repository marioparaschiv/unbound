import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
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
import { createStaging } from '~/sticker-staging/staging';

let dispose: () => Promise<void> | undefined = () => undefined;

/**
 * @description Stages picked stickers in the composer with a preview, and sends them with the message.
 * Patches the renders of `StickerPickerListRow`, `ChatInputSendButton` and `FloatingChatInputContainer`,
 * draws the preview with `Sticker`, and sends through `ChatInputs` and the message actions.
 * The hooks put on Discord's inputs and send buttons need `stopStickerStaging`, which removes the patches before it clears the staged stickers.
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

	const staging = createStaging();

	// The staging goes first so it is cleared last, once the patches that read it are gone.
	dispose = applyFeatures('Sticker Preview', [
		() => staging.dispose,
		() => patchStickerPickerListRow(staging),
		() => patchChatInputSendButton(staging),
		() => patchFloatingChatInputContainer(staging),
	]);
}

/**
 * @description Clears every staged sticker and puts back the send handlers and send buttons the plugin hooked.
 */
export function stopStickerStaging(): void {
	dispose();
	dispose = () => undefined;
}
