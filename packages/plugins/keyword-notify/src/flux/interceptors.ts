import { settings } from '@unbound-app/settings';
import { flux } from '@unbound-app/api';

import { mentionOnKeyword, type MentionedMessage, type MentionRules } from '~/lib/mentions';
import { createKeywordMatcher } from '~/lib/keywords';

type UserStore = { getCurrentUser(): { id: string } | undefined };

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
 * @description Marks new messages and loaded history that contain a keyword as mentions of the current user, so Discord highlights,
 * badges and notifies them like a ping. Intercepts `MESSAGE_CREATE` and `LOAD_MESSAGES_SUCCESS` and changes their messages in place.
 */
export function interceptKeywordMessages(): void {
	const Users = flux.getStore('User') as unknown as UserStore;

	flux.interceptAction('MESSAGE_CREATE', (action) => {
		if (settings.keywords.length) {
			mentionOnKeyword(
				(action as { message?: MentionedMessage }).message,
				currentRules(Users),
			);
		}

		return false;
	});

	flux.interceptAction('LOAD_MESSAGES_SUCCESS', (action) => {
		const { messages } = action as { messages?: MentionedMessage[] };

		if (settings.keywords.length && Array.isArray(messages)) {
			const rules = currentRules(Users);

			for (const message of messages) mentionOnKeyword(message, rules);
		}

		return false;
	});
}

export default { interceptKeywordMessages };
