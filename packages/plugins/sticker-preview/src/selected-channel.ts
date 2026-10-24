import { SelectedChannelStore } from '~/modules';

/**
 * @description The channel the user is looking at.
 * @returns Its id, or `undefined` when no channel is selected.
 */
export function selectedChannelId(): string | undefined {
	return (
		SelectedChannelStore.getCurrentlySelectedChannelId() ?? SelectedChannelStore.getChannelId()
	);
}

export default selectedChannelId;
