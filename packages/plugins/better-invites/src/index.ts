import { format, messages } from '@unbound-app/i18n';
import { flux, metro, patcher } from '@unbound-app/api';

import { expiryOf, inviteCodes, type Expiry } from '~/lib/invites';

type CodedLink = { type?: number; titleText?: string | null; headerText?: string | null };
type Row = { message?: { id?: string; channelId?: string; codedLinks?: CodedLink[] } };
type MessageStore = {
	getMessage(channelId: string, messageId: string): { content?: string } | undefined;
};
type Invite = {
	expires_at?: string | null;
	inviter?: { username?: string; globalName?: string; global_name?: string } | null;
	channel?: { name?: string } | null;
};
type InviteStore = { getInvite(code: string): Invite | undefined };
type ChatManagerClass = { prototype?: { createRow(...args: unknown[]): unknown } };

const INVITE_LINK = 0;

function expiryText(expiry: Expiry): string {
	switch (expiry.kind) {
		case 'never':
			return messages.NEVER_EXPIRES;
		case 'expired':
			return messages.EXPIRED;
		case 'minutes':
			return format('EXPIRES_IN_MINUTES', { count: expiry.count });
		case 'hours':
			return format('EXPIRES_IN_HOURS', { count: expiry.count });
		default:
			return format('EXPIRES_IN_DAYS', { count: expiry.count });
	}
}

function inviteHeader(invite: Invite): string {
	const inviter =
		invite.inviter?.global_name ?? invite.inviter?.globalName ?? invite.inviter?.username;

	return [
		inviter && format('FROM_INVITER', { name: inviter }),
		invite.channel?.name && format('TO_CHANNEL', { channel: invite.channel.name }),
		expiryText(expiryOf(invite.expires_at)),
	]
		.filter(Boolean)
		.join(' · ');
}

function describeInvites(row: Row): void {
	const message = row?.message;
	const links = message?.codedLinks?.filter(
		(link) => link.type === INVITE_LINK && link.titleText,
	);

	if (!links?.length || !message?.id || !message.channelId) return;

	const source = (flux.getStore('Message') as unknown as MessageStore).getMessage(
		message.channelId,
		message.id,
	);

	if (typeof source?.content !== 'string') return;

	const invites = flux.getStore('Invite') as unknown as InviteStore;
	const codes = inviteCodes(source.content);

	links.forEach((link, index) => {
		const invite = codes[index] ? invites.getInvite(codes[index]!) : undefined;

		if (invite) link.headerText = inviteHeader(invite);
	});
}

export function start() {
	if (!metro.findByName('ChatManager')) {
		logger.warn('Better invites skipped: Discord moved ChatManager.');

		return;
	}

	metro.onModuleLoaded(metro.filters.byName('ChatManager'), (ChatManager: ChatManagerClass) => {
		if (typeof ChatManager.prototype?.createRow !== 'function') {
			logger.warn('Better invites skipped: Discord moved ChatManager.createRow.');

			return;
		}

		patcher.after(ChatManager.prototype, 'createRow', ({ result }) => {
			try {
				describeInvites(result as Row);
			} catch (error) {
				logger.error('Failed to describe an invite in a chat row:', error);
			}
		});
	});
}

export function stop() {
	patcher.unpatchAll();
}
