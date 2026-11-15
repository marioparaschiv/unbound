import {
	onMessageRow,
	type MessageRow,
	type RowMessage,
} from '@unbound-plugins/shared/metro/message-rows';
import { settings } from '@unbound-app/settings';
import { messages } from '@unbound-app/i18n';
import { flux } from '@unbound-app/api';

import { isNewMember, sproutIcon, type SproutIcon } from '~/lib/sprout';

type SproutRow = MessageRow & { roleIcon?: SproutIcon | object | null };

type GuildMemberStore = {
	getMember(guildId: string, userId: string): { joinedAt?: string } | null;
};

/**
 * @description Shows a sprout in the role-icon slot of each message header whose author joined the server recently,
 * from members Discord already loaded. Leaves real role icons alone unless the user asks otherwise.
 */
export function patchMessageRows(): void {
	const Members = flux.getStore('GuildMember') as unknown as GuildMemberStore;

	onMessageRow<RowMessage, SproutRow>({
		feature: 'New member sprout',
		after({ row }) {
			if (!row?.guildId || !row.authorId || typeof row.username !== 'string') return;
			if (row.roleIcon && !settings.overRoleIcons) return;

			const member = Members.getMember(row.guildId, row.authorId);

			if (isNewMember(member?.joinedAt, settings.days))
				row.roleIcon = sproutIcon(messages.NEW_HERE);
		},
	});
}

export default { patchMessageRows };
