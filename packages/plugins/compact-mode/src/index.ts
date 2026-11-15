import { settings } from '@unbound-app/settings';
import { flux, metro, patcher } from '@unbound-app/api';

import { compactMessage, type CompactMessage } from '~/lib/compact';

type Row = { separatorBefore?: boolean; message?: CompactMessage };
type User = { username?: string; globalName?: string | null };
type MemberStore = { getNick(guildId: string, userId: string): string | null | undefined };
type UserStore = { getUser(userId: string): User | undefined };
type ChatManagerClass = { prototype?: { createRow(...args: unknown[]): unknown } };

function authorName(message: CompactMessage): string | undefined {
	if (!message.authorId) return undefined;

	const nick = message.guildId
		? (flux.getStore('GuildMember') as unknown as MemberStore).getNick?.(
				message.guildId,
				message.authorId,
			)
		: undefined;
	const user = (flux.getStore('User') as unknown as UserStore).getUser?.(message.authorId);

	return nick || user?.globalName || user?.username || undefined;
}

export function start() {
	if (!metro.findByName('ChatManager')) {
		logger.warn('Compact mode skipped: Discord moved ChatManager.');

		return;
	}

	metro.onModuleLoaded(metro.filters.byName('ChatManager'), (ChatManager: ChatManagerClass) => {
		if (typeof ChatManager.prototype?.createRow !== 'function') {
			logger.warn('Compact mode skipped: Discord moved ChatManager.createRow.');

			return;
		}

		patcher.after(ChatManager.prototype, 'createRow', ({ result }) => {
			const row = result as Row | undefined;

			if (!row?.message) return;

			try {
				const startsGroup = Boolean(row.message.isFirst);

				if (
					compactMessage(
						row.message,
						settings.everyMessage || startsGroup,
						authorName(row.message),
					)
				) {
					row.separatorBefore = false;
				}
			} catch (error) {
				logger.error('Failed to make a chat row compact:', error);
			}
		});
	});
}

export function stop() {
	patcher.unpatchAll();
}
