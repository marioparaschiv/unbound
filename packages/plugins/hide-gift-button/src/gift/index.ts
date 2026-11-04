import { recordApplied, recordFailure } from '@unbound-plugins/shared/lifecycle/health';
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

	const failures: string[] = [];

	// One patch throwing on an unexpected component shape must not cost the other.
	function attempt(name: string, patch: () => void) {
		try {
			patch();
			recordApplied(1);
		} catch (error) {
			logger.error(`Failed to hide the gift in ${name}:`, error);
			failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	attempt('ChatInputActionButtonGiftOrThread', () =>
		patcher.react.instead(GiftOrThreadButton, 'default', ({ props, original }) => {
			const { hideGiftButton }: GiftOrThreadProps = props ?? {};

			return typeof hideGiftButton === 'boolean'
				? original({ ...props, hideGiftButton: true })
				: null;
		}),
	);

	attempt('ChatInputRightActions', () =>
		patcher.react.after(ChatInputRightActions, 'default', ({ props, result }) => {
			const { shouldShowGiftButton }: RightActionsProps = props ?? {};

			if (!shouldShowGiftButton) return;

			return withoutGiftItem(result);
		}),
	);

	// Recorded last, because recording an applied feature clears an earlier failure.
	if (failures.length) recordFailure(failures.join('; '));
}
