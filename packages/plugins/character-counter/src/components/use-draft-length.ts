import { useEffect, useState } from 'react';

import { ChatInputs } from '~/counter/modules';

function readLength(channelId: string): number {
	const text = ChatInputs.getBestActiveInputForChannelId(channelId)?.getText?.();

	return typeof text === 'string' ? text.length : 0;
}

/**
 * @description Tracks the length of the message being written in a channel's composer.
 * @param channelId The channel whose composer to read.
 * @returns The draft's length in UTF-16 code units, as Discord counts it.
 */
export function useDraftLength(channelId: string): number {
	const [length, setLength] = useState(() => readLength(channelId));

	useEffect(() => {
		const refresh = () => setLength(readLength(channelId));

		refresh();

		// The composer emits no change event, so its text is polled.
		const timer = setInterval(refresh, 200);

		return () => clearInterval(timer);
	}, [channelId]);

	return length;
}
