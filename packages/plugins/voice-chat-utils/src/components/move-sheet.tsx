import { getActionSheetRow } from '@unbound-plugins/shared/action-sheets/action-sheet-row';
import { openSheet } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { Discord } from '@unbound-app/api/metro/components';
import { assets } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';

import { otherVoiceChannels } from '~/lib/members';
import { runOnEveryone } from '~/lib/run';

type Channel = { id: string; guild_id?: string; name?: string };

type MoveSheetProps = { channel: Channel; me: string; onClose: () => void };

function MoveSheet({ channel, me, onClose }: MoveSheetProps) {
	const ActionSheetRow = getActionSheetRow();
	const icon = assets.getIdByName('VoiceNormalIcon');
	const targets = channel.guild_id ? otherVoiceChannels(channel.guild_id, channel.id) : [];

	return (
		<Discord.ActionSheet>
			<Discord.Text
				variant='heading-lg/semibold'
				style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}
			>
				{messages.MOVE_TO}
			</Discord.Text>
			<ActionSheetRow.Group>
				{targets.map((target) => (
					<ActionSheetRow
						key={target.id}
						label={target.name ?? target.id}
						icon={icon ? <ActionSheetRow.Icon source={icon} /> : undefined}
						onPress={() => {
							onClose();
							void runOnEveryone(channel, 'MOVE_ALL', { channel_id: target.id }, me);
						}}
					/>
				))}
			</ActionSheetRow.Group>
		</Discord.ActionSheet>
	);
}

/**
 * @description Opens the sheet that picks the voice channel to move everyone into.
 * @param channel The channel people are moved out of.
 * @param me Your user id.
 */
export function openMoveSheet(channel: Channel, me: string): void {
	openSheet(`unbound-voice-chat-utils-move-${channel.id}`, MoveSheet, { channel, me });
}

export default MoveSheet;
