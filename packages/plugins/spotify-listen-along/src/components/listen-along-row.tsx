import { Discord } from '@unbound-app/api/metro/components';
import { assets } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { listenAlong, useListenState, useLoading } from '~/lib/sync';
import { isFollowing } from '~/lib/session';
import type { SpotifyActivity } from '~/lib/types';

type ListenAlongRowProps = {
	activity: SpotifyActivity;
	children: ReactNode;
};

/**
 * @description Puts a Listen Along button in front of Discord's own Spotify button.
 * @param props The activity and Discord's button.
 * @returns The row.
 */
export function ListenAlongRow({ activity, children }: ListenAlongRowProps) {
	const state = useListenState(activity);
	const [following, setFollowing] = useState(() => isFollowing(state.userId));
	const { loading, start } = useLoading();
	const disabled = Boolean(state.disabledReason);

	return (
		<View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
			<Discord.IconButton
				size='md'
				variant={following ? 'primary' : 'secondary'}
				icon={assets.getIdByName('HeadphonesIcon')}
				accessibilityLabel={following ? messages.STOP_LISTENING : messages.LISTEN_ALONG}
				loading={loading && !disabled}
				style={disabled ? { opacity: 0.5 } : undefined}
				onPress={() => {
					if (loading) return;

					if (listenAlong(state, activity)) start();

					setFollowing(isFollowing(state.userId));
				}}
			/>
			<View style={{ flex: 1 }}>{children}</View>
		</View>
	);
}

export default ListenAlongRow;
