import type { FluxUser } from '@unbound-app/api/flux';
import { useEffect, useState } from 'react';

import { ChatInputs, UserStore } from '~/modules';
import { characterLimit } from '~/counter';

type MessageCount = { length: number; limit: number };

type PremiumUser = FluxUser & { premiumType?: number };

function readCount(channelId: string): MessageCount {
	const text = ChatInputs.getBestActiveInputForChannelId(channelId)?.getText?.();
	const user: PremiumUser | undefined = UserStore.getCurrentUser();

	return {
		length: typeof text === 'string' ? text.length : 0,
		limit: characterLimit(user?.premiumType),
	};
}

/**
 * @description Tracks the length of the message being written in a channel and the user's limit.
 * @param channelId The channel whose composer to read.
 * @returns The current message length and the user's message length limit.
 */
function useMessageCount(channelId: string): MessageCount {
	const [count, setCount] = useState(() => readCount(channelId));

	useEffect(() => {
		function refresh() {
			const next = readCount(channelId);

			setCount((current) =>
				current.length === next.length && current.limit === next.limit ? current : next,
			);
		}

		refresh();

		// The composer emits no change event, so its text is polled.
		const timer = setInterval(refresh, 200);

		return () => clearInterval(timer);
	}, [channelId]);

	return count;
}

export default useMessageCount;
