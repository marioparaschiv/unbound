import { View } from 'react-native';
import type { ReactNode } from 'react';

import type { RenderNode } from '~/row-layout';
import type { Channel } from '~/types';

import ChannelTypingIndicator from './channel-typing-indicator';

type ThreadChannelInfoProps = {
	info: RenderNode | null | undefined;
	channel: Channel;
	muted: boolean;
};

// A thread row's `channelInfo`: the row's own info, if any, followed by the indicator.
function ThreadChannelInfo({ info, channel, muted }: ThreadChannelInfoProps) {
	const indicator = <ChannelTypingIndicator channel={channel} muted={muted} />;

	if (!info) return indicator;

	return (
		<View style={{ alignItems: 'center', flexDirection: 'row' }}>
			{info as ReactNode}
			{indicator}
		</View>
	);
}

export default ThreadChannelInfo;
