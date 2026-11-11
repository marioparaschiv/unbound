import { flux } from '@unbound-app/api';

const SelectedChannelStore = flux.getStore('SelectedChannel');

/**
 * @description Reads the channel the user is looking at.
 * @returns The selected channel's id, else the last selected one's, else `undefined`.
 */
export function selectedChannelId(): string | undefined {
	return (
		SelectedChannelStore.getChannelId() ||
		SelectedChannelStore.getLastSelectedChannelId() ||
		undefined
	);
}

export default selectedChannelId;
