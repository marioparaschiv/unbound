import { metro } from '@unbound-app/api';
import type { ComponentType } from 'react';

import { OVERLAY_BUTTON_PATH, OVERLAY_HEADER_PATH } from '~/constants';

export type OverlayButtonProps = {
	icon?: number;
	onPress?: () => void;
	accessibilityLabel?: string;
	accessibilityState?: { selected?: boolean };
};

export const OverlayHeaderModule = metro.findByFilePath(OVERLAY_HEADER_PATH, { interop: false });

const OverlayButtonModule = metro.findByFilePath(OVERLAY_BUTTON_PATH, { interop: false });

/**
 * @description Reads Discord's `MediaViewerOverlayButton` when the media viewer's header renders.
 * @returns The button, or `undefined` when this build has none.
 */
export function overlayButton(): ComponentType<OverlayButtonProps> | undefined {
	const exported = (OverlayButtonModule as { default?: unknown }).default;

	return typeof exported === 'function'
		? (exported as ComponentType<OverlayButtonProps>)
		: undefined;
}
