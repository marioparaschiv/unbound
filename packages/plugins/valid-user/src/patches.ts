import { flux, metro, patcher, plugins } from '@unbound-app/api';

import { unknownUserId, type MentionEvent } from '~/lib/mention-event';

type ContentHandlers = { onTapMention: (event: MentionEvent) => unknown };

const UserStore = flux.getStore('User');

async function showUnknownUser(userId: string, fallback: () => unknown): Promise<void> {
	const { AsyncUsers, Profiles } = metro.api;

	try {
		await AsyncUsers.getUser(userId);
	} catch (error) {
		logger.warn(`Failed to load user ${userId}:`, error);
		fallback();

		return;
	}

	if (!UserStore.getUser(userId)) {
		fallback();

		return;
	}

	Profiles.showUserProfile({ userId });
	plugins.redrawChat?.();
}

/**
 * @description Loads the user behind a tapped @unknown-user mention and opens their profile, instead of Discord's
 * no-access notice. Patches `onTapMention` on Discord's chat content handlers.
 */
export function patchMentionTaps(): void {
	const handlers = metro.findByFilePath('components_native/chat/contentHandlers.tsx')
		?.contentHandlers as ContentHandlers | undefined;

	if (!handlers || typeof handlers.onTapMention !== 'function') {
		logger.warn('Unknown user taps skipped: Discord moved its chat content handlers.');

		return;
	}

	patcher.instead(handlers, 'onTapMention', ({ args, original }) => {
		const userId = unknownUserId(args[0] as MentionEvent | undefined);

		if (!userId || UserStore.getUser(userId)) return original(...args);

		const event = args[0] as MentionEvent;
		const copy = { ...event, nativeEvent: { ...event.nativeEvent } };

		void showUnknownUser(userId, () => original(copy));

		return undefined;
	});
}
