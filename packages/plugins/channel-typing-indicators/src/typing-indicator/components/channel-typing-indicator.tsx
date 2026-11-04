import type { Channel } from '~/types';

import IndicatorBoundary from '~/typing-indicator/components/indicator-boundary';
import TypingIndicator from '~/typing-indicator/components/typing-indicator';

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
