import findRenderTarget from '@unbound-plugins/shared/react/render-target';
import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import type { AnyProps } from '@unbound-app/api/metro';

import { Patcher } from '~/modules';

/**
 * @description Renders the composer's gift-or-thread button with the gift hidden, and hides it outright when it cannot.
 * @returns A function that stops waiting for the button's module, or removes the patch.
 */
export function patchGiftOrThreadButton(): () => void {
	return whenLoaded(
		'modules/chat_input/native/action_buttons/ChatInputActionButtonGiftOrThread.tsx',
		(module: AnyProps) => {
			const target = findRenderTarget(module);

			if (!target) {
				console.error('[Hide Gift Button] Gift button component not found.');

				return () => {};
			}

			return Patcher.instead(
				target.holder,
				target.key,
				({ args: [props, ...rest], original }) =>
					typeof props?.hideGiftButton === 'boolean'
						? original({ ...props, hideGiftButton: true }, ...rest)
						: null,
			);
		},
	);
}
