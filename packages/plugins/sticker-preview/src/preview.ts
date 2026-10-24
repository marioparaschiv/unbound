import findRenderTarget, { type RenderTarget } from '@unbound-plugins/shared/react/render-target';
import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import type { AnyProps } from '@unbound-app/api/metro';
import type { ComponentType } from 'react';

import {
	ChatInputSendButton,
	FloatingChatInputContainer,
	StickerModules,
	StickerPickerListRowModules,
	type StickerProps,
} from '~/modules';
import { patchFloatingChatInputContainer } from '~/patches/floating-chat-input-container';
import { patchStickerPickerListRow } from '~/patches/sticker-picker-list-row';
import { patchChatInputSendButton } from '~/patches/chat-input-send-button';
import { createStaging } from '~/staging';

function firstTarget(candidates: AnyProps[]): RenderTarget | null {
	for (const candidate of candidates) {
		const target = findRenderTarget(candidate);

		if (target) {
			return target;
		}
	}

	return null;
}

/**
 * @description Stages picked stickers in the composer with a preview, and sends them with the message.
 * @returns A function that removes the patches and clears every staged sticker.
 */
export function applyStickerPreview(): () => void {
	const sticker = firstTarget(StickerModules);
	const pickerRow = firstTarget(StickerPickerListRowModules);
	const sendButton = findRenderTarget(ChatInputSendButton);
	const container = findRenderTarget(FloatingChatInputContainer);

	if (!sticker || !pickerRow || !sendButton || !container) {
		console.error(
			'[Sticker Preview] Skipped, render functions not found: Sticker, StickerPickerListRow, ChatInputSendButton or FloatingChatInputContainer.',
		);

		return () => {};
	}

	const Sticker: ComponentType<StickerProps> = sticker.holder[sticker.key];
	const staging = createStaging();

	return applyFeatures('Sticker Preview', [
		() => staging.dispose,
		() => patchStickerPickerListRow(pickerRow, staging),
		() => patchChatInputSendButton(sendButton, staging),
		() => patchFloatingChatInputContainer(container, staging, Sticker),
	]);
}
