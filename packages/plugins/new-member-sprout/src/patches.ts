import {
	onMessageRow,
	type MessageRow,
	type RowMessage,
} from '@unbound-plugins/shared/metro/message-rows';
import { flux, metro, patcher, utils } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';
import { messages } from '@unbound-app/i18n';
import type { ReactNode } from 'react';

import {
	isNewMember,
	isSproutSource,
	sproutIcon,
	sproutSource,
	type SproutIcon,
} from '~/lib/sprout';
import type { SproutTooltip, TouchPoint } from '~/native/tooltip';

type SproutRow = MessageRow & { roleIcon?: SproutIcon | object | null };

type GuildMemberStore = {
	getMember(guildId: string, userId: string): { joinedAt?: string; flags?: number } | null;
};

type UserStore = { getUser(userId: string): { bot?: boolean } | undefined };

type ThemeStore = { theme?: string };

type TouchEvent = { nativeEvent?: { pageX?: number; pageY?: number } };

type RoleIconEvent = { nativeEvent?: { roleIconSource?: string } };

type ChatProps = {
	onTouchStart?: (event: TouchEvent) => void;
	onTapRoleIcon?: (event: RoleIconEvent) => void;
};

function sproutColor(): string {
	const { Theme } = metro.common;
	const theme = (flux.getStore('Theme') as unknown as ThemeStore).theme ?? Theme.themes.DARK;

	return Theme.internal.resolveSemanticColor(theme, Theme.colors.TEXT_FEEDBACK_POSITIVE);
}

/**
 * @description Shows desktop's sprout in the role-icon slot of each message header whose author is new to the server, by
 * desktop's rule, from members Discord already loaded. Leaves real role icons alone unless the user asks otherwise.
 */
export function patchMessageRows(): void {
	const Members = flux.getStore('GuildMember') as unknown as GuildMemberStore;
	const Users = flux.getStore('User') as unknown as UserStore;

	onMessageRow<RowMessage, SproutRow>({
		feature: 'New member sprout',
		after({ row }) {
			if (!row?.guildId || !row.authorId || typeof row.username !== 'string') return;
			if (row.roleIcon && !settings.overRoleIcons) return;

			const member = Members.getMember(row.guildId, row.authorId);
			const facts = {
				guildId: row.guildId,
				joinedAt: member?.joinedAt,
				flags: member?.flags,
				bot: Users.getUser(row.authorId)?.bot,
			};

			if (!isNewMember(facts)) return;

			const source = sproutSource(sproutColor());

			if (source) row.roleIcon = sproutIcon(source, messages.NEW_HERE);
		},
	});
}

function wrapChat(chat: ChatProps, tooltip: SproutTooltip, touch: { last?: TouchPoint }) {
	const { onTouchStart, onTapRoleIcon } = chat;

	chat.onTouchStart = (event) => {
		const { pageX, pageY } = event?.nativeEvent ?? {};

		if (typeof pageX === 'number' && typeof pageY === 'number')
			touch.last = { x: pageX, y: pageY };

		onTouchStart?.(event);
	};
	chat.onTapRoleIcon = (event) => {
		if (!isSproutSource(event?.nativeEvent?.roleIconSource)) {
			onTapRoleIcon?.(event);

			return;
		}

		tooltip.show(touch.last, messages.NEW_HERE);
	};
}

/**
 * @description Opens the sprout's tooltip when it is tapped, pointing at the tap, since Discord reports no frame for a role
 * icon tap. Patches the render of Discord's `MessagesRenderer` to wrap the chat's touch and role icon handlers; Android's
 * chat sends no touches to JS, so its tooltip finds the tap natively.
 * @param tooltip The tooltip to open.
 */
export function patchSproutTaps(tooltip: SproutTooltip): void {
	const MessagesRenderer = metro.findByFilePath('modules/messages/native/MessagesRenderer.tsx');

	if (!MessagesRenderer?.default) {
		logger.warn('Sprout tooltip skipped: Discord moved MessagesRenderer.');

		return;
	}

	const touch: { last?: TouchPoint } = {};

	patcher.react.after(MessagesRenderer, 'default', ({ result }) => {
		const chat = utils.react.findInTree(
			result as ReactNode,
			(node: unknown) => typeof (node as ChatProps | null)?.onTapRoleIcon === 'function',
		) as ChatProps | undefined;

		if (chat) wrapChat(chat, tooltip, touch);
	});
}

export default { patchMessageRows, patchSproutTaps };
