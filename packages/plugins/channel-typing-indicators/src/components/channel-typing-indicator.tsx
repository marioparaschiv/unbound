import type { Channel } from '~/lib/types';

import IndicatorBoundary from '~/components/indicator-boundary';
import TypingIndicator from '~/components/typing-indicator';

type ChannelTypingIndicatorProps = {
	channel: Channel;
	muted: boolean;
};

function ChannelTypingIndicator({ channel, muted }: ChannelTypingIndicatorProps) {
	return (
		<IndicatorBoundary>
			<TypingIndicator channel={channel} muted={muted} />
		</IndicatorBoundary>
	);
}

export default ChannelTypingIndicator;
