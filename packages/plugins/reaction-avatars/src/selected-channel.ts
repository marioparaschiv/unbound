import { SelectedChannelStore } from '~/modules';

/**
 * @description Reads the channel the user is looking at.
 * @returns The selected channel, else the last selected one, else `undefined`.
 */
export function selectedChannelId(): string | undefined {
	return (
		SelectedChannelStore.getChannelId() ||
		SelectedChannelStore.getLastSelectedChannelId() ||
		undefined
	);
}
