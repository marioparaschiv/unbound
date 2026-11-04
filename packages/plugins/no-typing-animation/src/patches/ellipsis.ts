import findRenderTarget from '@unbound-plugins/shared/react/render-target';
import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import type { AnyProps } from '@unbound-app/api/metro';
import { patcher } from '@unbound-app/api';
import { cloneElement, createElement } from 'react';

import { stillDots, type DotElement } from '~/dots';
import StillDot from '~/components/still-dot';
import { ELLIPSIS_PATH, PLUGIN_NAME } from '~/constants';
import { TypingStore } from '~/modules';

function renderStillDot({ type, key, props }: DotElement) {
	return createElement(StillDot, { ...props, key, animated: type });
}

/**
 * @description Renders Discord's typing dots as still dots once their module loads. The dots show in the chat's typing indicator, the channel list, forum posts and the typing status on avatars.
 * @returns A function that stops waiting for the module, or removes the patch.
 */
export function patchEllipsis(): () => void {
	return whenLoaded<AnyProps>(ELLIPSIS_PATH, (module) => {
		const target = findRenderTarget(module);

		if (!target) {
			console.error(`[${PLUGIN_NAME}] Typing dots component not found.`);

			return () => {};
		}

		const unpatch = patcher.after(target.holder, target.key, ({ result }) => {
			const children = result?.props?.children;
			const still = stillDots(children, renderStillDot);

			if (still === children) return;

			return cloneElement(result, { children: still });
		});

		TypingStore.emitChange?.();

		return unpatch;
	});
}

export default patchEllipsis;
