import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { patcher } from '@unbound-app/api';
import type { ReactElement } from 'react';

import { ActivityButtons, SpotifyActions, SpotifyComponents } from '~/discord/modules';
import { ListenAlongRow } from '~/listen/components/listen-along-row';
import type { SpotifyActivity } from '~/types';
import { PLUGIN_NAME } from '~/constants';

type ButtonProps = { activity?: SpotifyActivity };

function withListenAlong(props: ButtonProps | undefined, result: ReactElement | null) {
	if (!result || !props?.activity?.party?.id) return result;

	return <ListenAlongRow activity={props.activity}>{result}</ListenAlongRow>;
}

/**
 * @description Adds a Listen Along button next to Discord's Spotify buttons on activity cards, which syncs your Spotify to the track and position of the person you are looking at.
 * Patches `PlayOnSpotifyButton` (profile activity cards) and `SpotifyPlayButton` (older activity layouts) and wraps their result.
 * Depends on Discord's Spotify actions (`play`, `sync`) and `SpotifyStore`, `SpotifyProtocolStore` and `UserStore`.
 * @returns A function that removes the patches.
 */
export function startListenAlong(): () => void {
	if (!ensureModules(`${PLUGIN_NAME}: listen along`, { ActivityButtons, SpotifyActions })) {
		return () => undefined;
	}

	const unpatches = [
		patcher.after(ActivityButtons, 'PlayOnSpotifyButton', ({ args, result }) =>
			withListenAlong(args[0] as ButtonProps, result as ReactElement | null),
		),
		patcher.after(SpotifyComponents, 'SpotifyPlayButton', ({ args, result }) =>
			withListenAlong(args[0] as ButtonProps, result as ReactElement | null),
		),
	];

	return () => unpatches.forEach((unpatch) => unpatch());
}
