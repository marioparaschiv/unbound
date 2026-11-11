import { messages } from '@unbound-app/i18n';
import { assets } from '@unbound-app/api';
import { useSyncExternalStore, type ComponentType } from 'react';

import type { OverlayButtonProps } from '~/lib/types';
import type { Controller } from '~/lib/controller';
import type { SessionStore } from '~/lib/session-store';
import { ICON_NAMES } from '~/lib/constants';
import { videoKey } from '~/lib/source';
import type { MediaSource } from '~/lib/types';

type PipButtonProps = {
	source: MediaSource | undefined;
	Button: ComponentType<OverlayButtonProps>;
	sessions: SessionStore<string>;
	controller: Controller<string>;
};

let icon: number | undefined;

function pipIcon(): number | undefined {
	icon ??= ICON_NAMES.map((name) => assets.getIdByName(name)).find((id) => id !== undefined);

	return icon;
}

/**
 * @description The media viewer header's picture in picture button. It shows only for a video, and toggles that video's window.
 * @param props The source the header shows, Discord's overlay button, and the plugin's sessions and controller.
 * @returns The button, or nothing when the header shows no video or the plugin has stopped.
 */
export function PipButton({ source, Button, sessions, controller }: PipButtonProps) {
	const session = useSyncExternalStore(sessions.subscribe, sessions.current);
	const disposed = useSyncExternalStore(controller.subscribe, controller.isDisposed);
	const target = videoKey(source);

	if (disposed || !target) return null;

	const active = session?.target === target;

	return (
		<Button
			icon={pipIcon()}
			accessibilityLabel={
				active ? messages.CLOSE_PICTURE_IN_PICTURE : messages.PICTURE_IN_PICTURE
			}
			accessibilityState={{ selected: active }}
			onPress={() => controller.toggle(target, source)}
		/>
	);
}

export default PipButton;
