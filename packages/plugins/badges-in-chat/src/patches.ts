import {
	onMessageRow,
	type MessageRow,
	type RowMessage,
} from '@unbound-plugins/shared/metro/message-rows';
import { settings } from '@unbound-app/settings';
import { flux } from '@unbound-app/api';

import { badgeIcon, type BadgeIcon, type ProfileBadge } from '~/lib/badges';

type BadgeRow = MessageRow & { roleIcon?: BadgeIcon | object | null };

type AuthoredMessage = RowMessage & { author?: { id?: string } };

type UserProfileStore = { getUserProfile(userId: string): { badges?: ProfileBadge[] } | undefined };

/**
 * @description Shows the author's first profile badge in the role-icon slot of each message header, from profiles Discord
 * already loaded. Leaves real role icons alone unless the user asks otherwise.
 */
export function patchMessageRows(): void {
	const Profiles = flux.getStore('UserProfile') as unknown as UserProfileStore;

	onMessageRow<AuthoredMessage, BadgeRow>({
		feature: 'Badges in chat',
		after({ message, row }) {
			const authorId = message?.author?.id;

			if (!row || typeof row.username !== 'string' || !authorId) return;
			if (row.roleIcon && !settings.overRoleIcons) return;

			const icon = badgeIcon(Profiles.getUserProfile(authorId)?.badges, settings.hidden);

			if (icon) row.roleIcon = icon;
		},
	});
}

export default { patchMessageRows };
