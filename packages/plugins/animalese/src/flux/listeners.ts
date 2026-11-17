import { flux } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';

import type { Speaker } from '~/lib/speaker';

type CreatedMessage = {
	channelId?: string;
	optimistic?: boolean;
	message?: { content?: string; author?: { id?: string; bot?: boolean } };
};

type UserStore = { getCurrentUser(): { id?: string } | undefined };

/**
 * @description Speaks each new message in the channel you have open, leaving out your own and bots' unless the
 * settings say otherwise.
 * @param speaker The Animalese speaker.
 * @returns A function that stops listening.
 */
export function listenToMessages(speaker: Speaker): () => void {
	const Selected = flux.getStore('SelectedChannel');
	const Users = flux.getStore('User') as unknown as UserStore;

	return flux.onAction('MESSAGE_CREATE', (action) => {
		const { channelId, optimistic, message } = action as CreatedMessage;
		const author = message?.author;

		if (
			optimistic ||
			!channelId ||
			channelId !== Selected.getChannelId?.() ||
			!message?.content ||
			!author?.id
		)
			return;
		if (author.bot && !settings.bots) return;
		if (author.id === Users.getCurrentUser()?.id && !settings.own) return;

		void speaker.speak(message.content, author.id);
	});
}
