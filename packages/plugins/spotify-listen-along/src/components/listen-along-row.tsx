import { Discord } from '@unbound-app/api/metro/components';
import { assets } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { listenAlong, useListenState, useLoading, type SpotifyActions } from '~/lib/sync';
import type { SpotifyActivity } from '~/lib/types';

type ListenAlongRowProps = {
	activity: SpotifyActivity;
	actions: SpotifyActions;
	children: ReactNode;
};

/**
 * @description Puts a Listen Along button in front of Discord's own Spotify button.
 * @param props The activity, Discord's Spotify actions and Discord's button.
 * @returns The row.
 */
export function ListenAlongRow({ activity, actions, children }: ListenAlongRowProps) {
	const state = useListenState(activity);
	const { loading, start } = useLoading();
	const disabled = Boolean(state.disabledReason);

	return (
		<View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
			<Discord.IconButton
				size='md'
				variant='secondary'
				icon={assets.getIdByName('HeadphonesIcon')}
				accessibilityLabel={messages.LISTEN_ALONG}
				loading={loading && !disabled}
				style={disabled ? { opacity: 0.5 } : undefined}
				onPress={() => {
					if (!loading && listenAlong(state, activity, actions)) start();
				}}
			/>
			<View style={{ flex: 1 }}>{children}</View>
		</View>
	);
}

export default ListenAlongRow;
