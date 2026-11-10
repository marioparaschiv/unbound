import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { patcher } from '@unbound-app/api';
import type { ReactElement } from 'react';

import { ActivityButtons, SpotifyActions, SpotifyComponents } from '~/listen/modules';
import { ListenAlongRow } from '~/listen/components/listen-along-row';
import type { SpotifyActivity } from '~/types';

type ButtonProps = { activity?: SpotifyActivity };

function withListenAlong(props: ButtonProps | undefined, result: ReactElement | null) {
	if (!result || !props?.activity?.party?.id) return result;

	return <ListenAlongRow activity={props.activity}>{result}</ListenAlongRow>;
}

/**
 * @description Adds a Listen Along button next to Discord's Spotify buttons on activity cards, which syncs your Spotify to the track and position of the person you are looking at.
 * Patches `PlayOnSpotifyButton` (profile activity cards) and `SpotifyPlayButton` (older activity layouts) and wraps their result.
 * Depends on Discord's Spotify actions (`play`, `sync`) and `SpotifyStore`, `SpotifyProtocolStore` and `UserStore`.
 */
export function startListenAlong(): void {
	if (!ensureModules({ ActivityButtons, SpotifyActions }, 'listen along')) {
		return;
	}

	patcher.react.after(ActivityButtons, 'PlayOnSpotifyButton', ({ props, result }) =>
		withListenAlong(props as ButtonProps, result as ReactElement | null),
	);
	patcher.react.after(SpotifyComponents, 'SpotifyPlayButton', ({ props, result }) =>
		withListenAlong(props as ButtonProps, result as ReactElement | null),
	);
}
