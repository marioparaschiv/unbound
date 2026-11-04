import { recordApplied } from '@unbound-plugins/shared/lifecycle/health';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { patcher } from '@unbound-app/api';

import { withoutGiftItem } from '~/gift/gift-item';
import { ChatInputRightActions, GiftOrThreadButton } from '~/gift/modules';

type GiftOrThreadProps = { hideGiftButton?: boolean };
type RightActionsProps = { shouldShowGiftButton?: boolean };

/**
 * @description Hides the gift button from the composer.
 * Patches the render of `ChatInputActionButtonGiftOrThread` to hide the gift, or itself when it cannot,
 * and of `ChatInputRightActions` to drop the animated slot that holds the gift button.
 * The Addon scope removes both patches when the plugin stops.
 */
export function startGift(): void {
	if (!ensureModules('Hide Gift Button', { GiftOrThreadButton, ChatInputRightActions })) return;

	patcher.react.instead(GiftOrThreadButton, 'default', ({ props, original }) => {
		const { hideGiftButton }: GiftOrThreadProps = props ?? {};

		return typeof hideGiftButton === 'boolean'
			? original({ ...props, hideGiftButton: true })
			: null;
	});

	patcher.react.after(ChatInputRightActions, 'default', ({ props, result }) => {
		const { shouldShowGiftButton }: RightActionsProps = props ?? {};

		if (!shouldShowGiftButton) return;

		return withoutGiftItem(result);
	});

	recordApplied(2);
}
