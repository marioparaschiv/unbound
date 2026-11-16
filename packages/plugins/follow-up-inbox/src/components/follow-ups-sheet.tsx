import { getActionSheetRow } from '@unbound-plugins/shared/action-sheets/action-sheet-row';
import { Discord } from '@unbound-app/api/metro/components';
import { assets, flux, toasts } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';

import { removeFollowUp, type FollowUp } from '~/lib/follow-ups';
import { getFollowUps, saveFollowUps, useFollowUps } from '~/lib/store';
import { openMessage } from '~/lib/open-message';

type FollowUpsSheetProps = { onClose: () => void };

type ChannelStore = { getChannel(channelId: string): { name?: string } | undefined };

function placeOf(entry: FollowUp): string {
	const channel = (flux.getStore('Channel') as unknown as ChannelStore).getChannel(
		entry.channelId,
	);
	const when = new Date(entry.addedAt).toLocaleDateString();
	const name = channel?.name ? `#${channel.name}` : messages.DIRECT_MESSAGE;

	return `${name} · ${when}`;
}

function markDone(entry: FollowUp) {
	saveFollowUps(removeFollowUp(getFollowUps(), entry.messageId));
	toasts.success('DONE');
}

/**
 * @description Lists the follow-ups, newest first: tapping one opens its message, long-pressing marks it done.
 * @param props Closes the sheet.
 * @returns The sheet.
 */
export default function FollowUpsSheet({ onClose }: FollowUpsSheetProps) {
	const list = useFollowUps();
	const ActionSheetRow = getActionSheetRow();
	const icon = assets.getIdByName('ChatDotsIcon');

	return (
		<Discord.ActionSheet>
			<Discord.Text
				variant='heading-lg/semibold'
				style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}
			>
				{messages.TITLE}
			</Discord.Text>
			<Discord.Text
				variant='text-sm/medium'
				color='text-muted'
				style={{ paddingHorizontal: 16, paddingBottom: 12 }}
			>
				{list.length ? messages.HINT : messages.EMPTY}
			</Discord.Text>
			{list.length ? (
				<ActionSheetRow.Group>
					{list.map((entry) => (
						<ActionSheetRow
							key={entry.messageId}
							label={`${entry.author}: ${entry.snippet || messages.NO_TEXT}`}
							subLabel={placeOf(entry)}
							icon={icon ? <ActionSheetRow.Icon source={icon} /> : undefined}
							onPress={() => {
								onClose();
								openMessage(entry);
							}}
							onLongPress={() => markDone(entry)}
						/>
					))}
				</ActionSheetRow.Group>
			) : null}
		</Discord.ActionSheet>
	);
}
