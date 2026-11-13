import { settings } from '@unbound-app/settings';
import { flux } from '@unbound-app/api';

import { mentionOnKeyword, type MentionedMessage, type MentionRules } from '~/lib/mentions';
import { createKeywordMatcher } from '~/lib/keywords';
import { parseIdList } from '@unbound-plugins/shared/entities/id-list';

type UserStore = { getCurrentUser(): { id: string } | undefined };

type ChannelStore = {
	getChannel(id: string): { guild_id?: string | null; parent_id?: string | null } | undefined;
};

type LocatedMessage = MentionedMessage & { channel_id?: string; author?: { id?: string } };

function isIgnored(
	Channels: ChannelStore,
	message: LocatedMessage | undefined,
	channelId?: string,
): boolean {
	const channel = channelId ?? message?.channel_id;
	const author = message?.author?.id;

	if (author && parseIdList(settings.ignoreUsers).includes(author)) return true;
	if (!channel) return false;

	const ignoredChannels = parseIdList(settings.ignoreChannels);
	const record = Channels.getChannel(channel);

	if (ignoredChannels.includes(channel)) return true;
	if (record?.parent_id && ignoredChannels.includes(record.parent_id)) return true;

	return Boolean(
		record?.guild_id && parseIdList(settings.ignoreGuilds).includes(record.guild_id),
	);
}

function currentRules(Users: UserStore): MentionRules {
	return {
		currentUserId: Users.getCurrentUser()?.id,
		ignoreBots: settings.ignoreBots,
		matches: createKeywordMatcher({
			keywords: settings.keywords,
			regex: settings.regex,
			caseSensitive: settings.caseSensitive,
			wholeWords: settings.wholeWords,
		}),
	};
}

/**
 * @description Marks new messages and loaded history that contain a keyword as mentions of the current user, outside ignored
 * users, channels and servers, so Discord highlights, badges and notifies them like a ping. Intercepts `MESSAGE_CREATE` and `LOAD_MESSAGES_SUCCESS` and changes their messages in place.
 */
export function interceptKeywordMessages(): void {
	const Users = flux.getStore('User') as unknown as UserStore;
	const Channels = flux.getStore('Channel') as unknown as ChannelStore;

	flux.interceptAction('MESSAGE_CREATE', (action) => {
		const message = (action as { message?: LocatedMessage }).message;

		if (settings.keywords.length && !isIgnored(Channels, message)) {
			mentionOnKeyword(message, currentRules(Users));
		}

		return false;
	});

	flux.interceptAction('LOAD_MESSAGES_SUCCESS', (action) => {
		const { messages, channelId } = action as {
			messages?: LocatedMessage[];
			channelId?: string;
		};

		if (settings.keywords.length && Array.isArray(messages)) {
			const rules = currentRules(Users);

			for (const message of messages) {
				if (!isIgnored(Channels, message, channelId)) mentionOnKeyword(message, rules);
			}
		}

		return false;
	});
}

export default { interceptKeywordMessages };
