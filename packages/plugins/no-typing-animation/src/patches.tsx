import { cloneElement, createElement, isValidElement, type ReactNode } from 'react';
import { flux, metro, patcher } from '@unbound-app/api';

import { stillDots, type DotElement } from '~/lib/dots';
import { ELLIPSIS_PATH } from '~/lib/constants';
import StillDot from '~/components/still-dot';

const TypingStore = flux.getStore('Typing');

function renderStillDot({ key, props }: DotElement) {
	return createElement(StillDot, { ...props, key });
}

/**
 * @description Renders Discord's typing dots as still dots. The dots show in the chat's typing indicator, the channel list, forum posts and the typing status on avatars.
 * Patches the render of the `Ellipsis` component (`design/void/Ellipsis`) and asks `TypingStore` to emit so mounted dots redraw.
 */
export function patchEllipsis(): void {
	const Ellipsis = metro.findByFilePath(ELLIPSIS_PATH);

	if (!Ellipsis) {
		logger.warn('Still dots skipped: Discord moved Ellipsis.');

		return;
	}

	patcher.react.after(Ellipsis, 'default', ({ result }) => {
		if (!isValidElement<{ children?: ReactNode }>(result)) return;

		const children = result.props.children;
		const still = stillDots(children, renderStillDot);

		if (still === children) return;

		return cloneElement(result, { children: still });
	});

	TypingStore.emitChange?.();
}
