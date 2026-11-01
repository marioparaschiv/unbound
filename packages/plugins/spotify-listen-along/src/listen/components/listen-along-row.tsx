import { Discord } from '@unbound-app/api/metro/components';
import { assets } from '@unbound-app/api';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { listenAlong, useListenState, useLoading } from '~/listen/sync';
import type { SpotifyActivity } from '~/types';

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
	const { loading, start } = useLoading();
	const disabled = Boolean(state.disabledReason);

	return (
		<View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
			<Discord.IconButton
				size='md'
				variant='secondary'
				icon={assets.getIdByName('HeadphonesIcon')}
				accessibilityLabel='Listen Along'
				loading={loading && !disabled}
				style={disabled ? { opacity: 0.5 } : undefined}
				onPress={() => {
					if (!loading && listenAlong(state, activity)) start();
				}}
			/>
			<View style={{ flex: 1 }}>{children}</View>
		</View>
	);
}

export default ListenAlongRow;
