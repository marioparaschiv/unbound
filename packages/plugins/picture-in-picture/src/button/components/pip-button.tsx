import { assets } from '@unbound-app/api';
import { useSyncExternalStore, type ComponentType } from 'react';

import type { OverlayButtonProps } from '~/button/modules';
import type { PlayerRegistry } from '~/players/registry';
import type { Controller } from '~/session/controller';
import type { SessionStore } from '~/session/store';
import { ICON_NAMES } from '~/constants';
import type { MediaSource, VideoInstance } from '~/types';

type PipButtonProps = {
	source: MediaSource | undefined;
	Button: ComponentType<OverlayButtonProps>;
	players: PlayerRegistry;
	sessions: SessionStore<VideoInstance>;
	controller: Controller<VideoInstance>;
};

let icon: number | undefined;

function pipIcon(): number | undefined {
	icon ??= ICON_NAMES.map((name) => assets.getIdByName(name)).find((id) => id !== undefined);

	return icon;
}

/**
 * @description The media viewer header's picture in picture button. It shows only for a video whose player is on screen, and toggles that player's window.
 * @param props The source the header shows, Discord's overlay button, and the plugin's registry, sessions and controller.
 * @returns The button, or nothing when the header shows no playable video or the plugin has stopped.
 */
export function PipButton({ source, Button, players, sessions, controller }: PipButtonProps) {
	useSyncExternalStore(players.subscribe, players.version);

	const disposed = useSyncExternalStore(controller.subscribe, controller.isDisposed);

	if (disposed) return null;

	const target = players.pick(source);

	if (!target) return null;

	const active = sessions.of(target) !== null;

	return (
		<Button
			icon={pipIcon()}
			accessibilityLabel={active ? 'Close Picture in Picture' : 'Picture in Picture'}
			accessibilityState={{ selected: active }}
			onPress={() => controller.toggle(target, source)}
		/>
	);
}

export default PipButton;
