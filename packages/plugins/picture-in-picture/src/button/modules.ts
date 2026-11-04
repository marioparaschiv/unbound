import { metro } from '@unbound-app/api';
import type { ComponentType } from 'react';

import { OVERLAY_BUTTON_PATH } from '~/constants';

export type OverlayButtonProps = {
	icon?: number;
	onPress?: () => void;
	accessibilityLabel?: string;
	accessibilityState?: { selected?: boolean };
};

const OverlayButtonModule = metro.findByFilePath(OVERLAY_BUTTON_PATH, {
	lazy: true,
	interop: false,
});

/**
 * @description Reads Discord's `MediaViewerOverlayButton` when the media viewer's header renders, since a lazy handle cannot be rendered.
 * @returns The button, or `undefined` when this build has none.
 */
export function overlayButton(): ComponentType<OverlayButtonProps> | undefined {
	const exported = (OverlayButtonModule.module as { default?: unknown } | undefined)?.default;

	return typeof exported === 'function'
		? (exported as ComponentType<OverlayButtonProps>)
		: undefined;
}
