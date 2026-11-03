import { getElementName } from '@unbound-plugins/shared/react/find-element';
import { recordSkip } from '@unbound-plugins/shared/lifecycle/health';
import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import type { Bucket } from '@unbound-app/api/storage';
import { metro, patcher } from '@unbound-app/api';
import { cloneElement, type ReactElement } from 'react';

import { withElementProps, type CloneElement, type TreeElement } from '~/tree/edit';
import type { SessionStore } from '~/session/store';
import type { HoldStore } from '~/session/hold';
import type { PlayerRegistry } from '~/players/registry';
import { sessionProps } from '~/players/platform';
import { HELD_PROPS, PLUGIN_NAME, SETTINGS, VIDEO_PROTOTYPE } from '~/constants';
import type { VideoInstance } from '~/types';

type VideoClass = { prototype: { render?: unknown } };

type StatusEvent = { nativeEvent?: { isActive?: unknown } };

const clone: CloneElement = (element, props) =>
	cloneElement(element as ReactElement, props) as TreeElement;

function videoClass(module: unknown): VideoClass | undefined {
	const candidate =
		typeof module === 'function' ? module : (module as { default?: unknown })?.default;

	return typeof candidate === 'function' && typeof candidate.prototype?.render === 'function'
		? (candidate as VideoClass)
		: undefined;
}

function isNativeVideo(element: TreeElement): boolean {
	const props = element.props ?? {};

	return (
		getElementName(element as Parameters<typeof getElementName>[0]) === 'RCTVideo' ||
		(typeof props.src === 'object' && typeof props.onVideoLoad === 'function')
	);
}

function call(handler: unknown, event: unknown) {
	if (typeof handler === 'function') handler(event);
}

function eventProps(
	element: TreeElement,
	instance: VideoInstance,
	sessions: SessionStore<VideoInstance>,
): Record<string, unknown> {
	const { onPictureInPictureStatusChanged, onRestoreUserInterfaceForPictureInPictureStop } =
		element.props ?? {};

	return {
		onPictureInPictureStatusChanged(event: StatusEvent) {
			call(onPictureInPictureStatusChanged, event);

			if (event?.nativeEvent?.isActive === true) sessions.activate(instance);
			else sessions.end(instance);
		},
		onRestoreUserInterfaceForPictureInPictureStop(event: unknown) {
			call(onRestoreUserInterfaceForPictureInPictureStop, event);
			sessions.restore(instance);
		},
	};
}

/**
 * @description Lets a picture in picture session drive the `react-native-video` player it belongs to.
 * @param players The registry to record players in.
 * @param sessions The session store.
 * @param holds The players kept paused after their window was dismissed.
 * @param settings The plugin's settings, read for `loop` on each render.
 * @returns A function that removes the patch and redraws every player without the session's props.
 */
export function patchVideoPlayers(
	players: PlayerRegistry,
	sessions: SessionStore<VideoInstance>,
	holds: HoldStore<VideoInstance>,
	settings: Bucket,
): () => void {
	const redraw = sessions.subscribe((previous, next) => {
		previous?.target.forceUpdate?.();

		if (next && next.target !== previous?.target) next.target.forceUpdate?.();

		players.changed();
	});

	const redrawHeld = holds.subscribe((player) => player.forceUpdate?.());

	const unpatch = whenLoaded(metro.filters.byPrototypes(...VIDEO_PROTOTYPE), (module) => {
		const Video = videoClass(module);

		if (!Video) {
			const reason = 'react-native-video has no Video class';

			console.error(`[${PLUGIN_NAME}] Skipped, ${reason}.`);
			recordSkip(reason);

			return;
		}

		return patcher.after(
			Video.prototype as { render: () => unknown },
			'render',
			({ this: instance, result }) => {
				const player = instance as VideoInstance;

				players.track(player);

				const props =
					sessionProps(sessions.of(player), settings.get('loop', SETTINGS.loop)) ??
					(holds.has(player) ? HELD_PROPS : null);

				if (!props) return result;

				return withElementProps(
					result,
					isNativeVideo,
					(element) => ({ ...props, ...eventProps(element, player, sessions) }),
					clone,
				);
			},
		);
	});

	return () => {
		const active = sessions.current()?.target;

		redraw();
		redrawHeld();
		unpatch();
		sessions.end();

		for (const player of players.all()) player.forceUpdate?.();

		active?.forceUpdate?.();
	};
}
