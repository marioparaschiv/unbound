import findRenderTarget from '@unbound-plugins/shared/react/render-target';
import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import type { AnyProps } from '@unbound-app/api/metro';

import { withoutGiftItem } from '~/gift-item';
import { Patcher } from '~/modules';

/**
 * @description Removes the gift button's slot from the composer's right-hand actions.
 * @returns A function that stops waiting for the actions' module, or removes the patch.
 */
export function patchChatInputRightActions(): () => void {
	return whenLoaded(
		'modules/chat_input/native/action_buttons/ChatInputRightActions.tsx',
		(module: AnyProps) => {
			const target = findRenderTarget(module);

			if (!target) {
				console.error('[Hide Gift Button] Composer actions component not found.');

				return () => {};
			}

			return Patcher.after(target.holder, target.key, ({ args: [props], result }) => {
				if (!props?.shouldShowGiftButton || !result?.props) return;

				return withoutGiftItem(result);
			});
		},
	);
}
