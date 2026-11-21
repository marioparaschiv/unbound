import { useSyncExternalStore } from 'react';
import { messages, format } from '@unbound-app/i18n';
import { ui } from '@unbound-app/api';

import {
	clearDeletedChannels,
	deletedChannels,
	isThread,
	onDeletedChannelsChange,
	type DeletedChannel,
} from '~/lib/deleted-channels';

/**
 * @description Reads the deleted channels, redrawing when they change.
 * @returns The channels, newest first.
 */
export function useDeletedChannels(): DeletedChannel[] {
	return useSyncExternalStore(onDeletedChannelsChange, deletedChannels);
}

function describe(channel: DeletedChannel): string {
	const parent =
		isThread(channel) && channel.categoryName
			? format('DELETED_THREAD_IN', { channel: channel.categoryName })
			: channel.categoryName;
	const place = [channel.guildName || channel.guildId, parent].filter(Boolean).join(' · ');
	const when = format('DELETED_CHANNEL_AT', {
		time: new Date(channel.deletedAt).toLocaleString(),
	});
	const topic = channel.topic ? `\n${channel.topic}` : '';

	return `${place}\n${when}${topic}`;
}

/**
 * @description The deleted server channels, newest first, with a row that clears them.
 * @returns The list.
 */
function DeletedChannels() {
	const channels = useDeletedChannels();

	return (
		<>
			<ui.Section
				title={messages.DELETED_CHANNELS}
				description={messages.DELETED_CHANNELS_DESCRIPTION}
			>
				{channels.length === 0 ? (
					<ui.Row label={messages.NO_DELETED_CHANNELS} />
				) : (
					channels.map((channel) => (
						<ui.Row
							key={channel.id}
							label={`#${channel.name || channel.id}`}
							subLabel={describe(channel)}
						/>
					))
				)}
			</ui.Section>
			{channels.length > 0 && (
				<ui.Section>
					<ui.ButtonRow
						label={messages.CLEAR_DELETED_CHANNELS}
						variant='danger'
						onPress={clearDeletedChannels}
					/>
				</ui.Section>
			)}
		</>
	);
}

export default DeletedChannels;
