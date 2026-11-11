import { useEffect, useState } from 'react';

/** Discord's composer inputs, which hold each channel's draft. */
export type ChatInputs = {
	// UNKNOWN: Discord's input handle is untyped; only its `getText` is read.
	getBestActiveInputForChannelId: (channelId: string) => { getText?: () => unknown } | undefined;
};

function readLength(inputs: ChatInputs, channelId: string): number {
	const text = inputs.getBestActiveInputForChannelId(channelId)?.getText?.();

	return typeof text === 'string' ? text.length : 0;
}

/**
 * @description Tracks the length of the message being written in a channel's composer.
 * @param inputs Discord's composer inputs.
 * @param channelId The channel whose composer to read.
 * @returns The draft's length in UTF-16 code units, as Discord counts it.
 */
export function useDraftLength(inputs: ChatInputs, channelId: string): number {
	const [length, setLength] = useState(() => readLength(inputs, channelId));

	useEffect(() => {
		const refresh = () => setLength(readLength(inputs, channelId));

		refresh();

		// The composer emits no change event, so its text is polled.
		const timer = setInterval(refresh, 200);

		return () => clearInterval(timer);
	}, [inputs, channelId]);

	return length;
}
