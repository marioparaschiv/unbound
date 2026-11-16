import { settings } from '@unbound-app/settings';
import { flux } from '@unbound-app/api';

import { isIgnored, type ChannelStore, type LocatedMessage } from '~/lib/ignored';
import { mentionOnKeyword, type MentionedMessage, type MentionRules } from '~/lib/mentions';
import { createKeywordMatcher } from '~/lib/keywords';
import { rememberInboxHit } from '~/flux/inbox';

type UserStore = { getCurrentUser(): { id: string } | undefined };

type KeywordMessage = MentionedMessage & LocatedMessage;

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
 * users, channels and servers, so Discord highlights, badges and notifies them like a ping, and saves new ones for the mentions inbox. Intercepts `MESSAGE_CREATE` and `LOAD_MESSAGES_SUCCESS` and changes their messages in place.
 */
export function interceptKeywordMessages(): void {
	const Users = flux.getStore('User') as unknown as UserStore;
	const Channels = flux.getStore('Channel') as unknown as ChannelStore;

	flux.interceptAction('MESSAGE_CREATE', (action) => {
		const { message, optimistic } = action as {
			message?: KeywordMessage;
			optimistic?: boolean;
		};

		if (
			settings.keywords.length &&
			!isIgnored(Channels, message) &&
			mentionOnKeyword(message, currentRules(Users)) &&
			!optimistic
		) {
			rememberInboxHit(message);
		}

		return false;
	});

	flux.interceptAction('LOAD_MESSAGES_SUCCESS', (action) => {
		const { messages, channelId } = action as {
			messages?: KeywordMessage[];
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
