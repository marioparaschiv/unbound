import { IndicatorsRunning } from '~/modules';
import type { Channel } from '~/types';

import IndicatorBoundary from './indicator-boundary';
import TypingIndicator from './typing-indicator';

type ChannelTypingIndicatorProps = {
	channel: Channel;
	muted: boolean;
};

// Stays mounted in rows rendered while the plugin ran, so it renders nothing once the plugin stops.
function ChannelTypingIndicator({ channel, muted }: ChannelTypingIndicatorProps) {
	if (!IndicatorsRunning.useRunning()) return null;

	return (
		<IndicatorBoundary>
			<TypingIndicator channel={channel} muted={muted} />
		</IndicatorBoundary>
	);
}

export default ChannelTypingIndicator;
