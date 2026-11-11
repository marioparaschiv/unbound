import { metro, patcher } from '@unbound-app/api';

import { withoutGiftItem } from '~/lib/gift-item';

type GiftOrThreadProps = { hideGiftButton?: boolean };
type RightActionsProps = { shouldShowGiftButton?: boolean };

const folder = 'modules/chat_input/native/action_buttons/';

/**
 * @description Hides the gift from the composer's gift-or-thread button, or the button itself when it has no gift option,
 * by patching the render of Discord's `ChatInputActionButtonGiftOrThread`.
 */
export function patchGiftOrThreadButton(): void {
	const GiftOrThreadButton = metro.findByFilePath(
		`${folder}ChatInputActionButtonGiftOrThread.tsx`,
	);

	if (!GiftOrThreadButton) {
		logger.warn('Gift button skipped: Discord moved ChatInputActionButtonGiftOrThread.');

		return;
	}

	// An unexpected component shape must not cost the other patch, so it is logged instead of failing the start.
	try {
		patcher.react.instead(GiftOrThreadButton, 'default', ({ props, original }) => {
			const { hideGiftButton }: GiftOrThreadProps = props ?? {};

			return typeof hideGiftButton === 'boolean'
				? original({ ...props, hideGiftButton: true })
				: null;
		});
	} catch (error) {
		logger.error('Failed to patch ChatInputActionButtonGiftOrThread:', error);
	}
}

/**
 * @description Drops the animated slot that holds the gift button, by patching the render of Discord's `ChatInputRightActions`.
 */
export function patchChatInputRightActions(): void {
	const ChatInputRightActions = metro.findByFilePath(`${folder}ChatInputRightActions.tsx`);

	if (!ChatInputRightActions) {
		logger.warn('Gift slot skipped: Discord moved ChatInputRightActions.');

		return;
	}

	// An unexpected component shape must not cost the other patch, so it is logged instead of failing the start.
	try {
		patcher.react.after(ChatInputRightActions, 'default', ({ props, result }) => {
			const { shouldShowGiftButton }: RightActionsProps = props ?? {};

			if (!shouldShowGiftButton) return;

			return withoutGiftItem(result);
		});
	} catch (error) {
		logger.error('Failed to patch ChatInputRightActions:', error);
	}
}
