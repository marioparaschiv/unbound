import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { cloneElement, createElement, isValidElement, type ReactNode } from 'react';
import { patcher } from '@unbound-app/api';

import { Ellipsis, TypingStore } from '~/still-dots/modules';
import { stillDots, type DotElement } from '~/still-dots/dots';
import StillDot from '~/still-dots/components/still-dot';

function renderStillDot({ key, props }: DotElement) {
	return createElement(StillDot, { ...props, key });
}

/**
 * @description Renders Discord's typing dots as still dots. The dots show in the chat's typing indicator, the channel list, forum posts and the typing status on avatars.
 * Patches the render of the `Ellipsis` component (`design/void/Ellipsis`) and asks `TypingStore` to emit so mounted dots redraw.
 * The Addon scope removes the patch when the plugin stops, and mounted dots re-render as Discord's.
 */
export function startStillDots(): void {
	if (!ensureModules({ Ellipsis })) return;

	patcher.react.after(Ellipsis, 'default', ({ result }) => {
		if (!isValidElement<{ children?: ReactNode }>(result)) return;

		const children = result.props.children;
		const still = stillDots(children, renderStillDot);

		if (still === children) return;

		return cloneElement(result, { children: still });
	});

	TypingStore.emitChange?.();
}
