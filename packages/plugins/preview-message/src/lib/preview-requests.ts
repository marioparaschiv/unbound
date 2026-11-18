import { useEffect } from 'react';

type Listener = (channelId: string) => void;

const listeners = new Set<Listener>();

/**
 * @description Asks the preview button of a channel to open its preview, as the Plugin Shortcut Panel's row does.
 * @param channelId The channel whose draft to preview.
 */
export function requestPreview(channelId: string): void {
	for (const listener of listeners) listener(channelId);
}

/**
 * @description Calls back when the preview of a channel is asked for from outside its button.
 * @param channelId The button's channel.
 * @param onRequest Opens the preview.
 */
export function usePreviewRequests(channelId: string, onRequest: () => void): void {
	useEffect(() => {
		const listener: Listener = (requested) => {
			if (requested === channelId) onRequest();
		};

		listeners.add(listener);

		return () => {
			listeners.delete(listener);
		};
	}, [channelId, onRequest]);
}
