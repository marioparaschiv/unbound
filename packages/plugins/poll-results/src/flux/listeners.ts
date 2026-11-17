import { flux, metro } from '@unbound-app/api';

import { hidesResults, type PollMessage } from '~/lib/polls';

type PollState = {
	channelId: string;
	selectedAnswerIds: Set<string>;
	submitting: boolean;
	editing: boolean;
	showResults: boolean;
};

type PollStore = {
	getPollState(channelId: string, messageId: string): PollState | undefined;
	updatePollState(
		channelId: string,
		messageId: string,
		update: (previous: PollState | undefined) => PollState,
	): void;
};

type MessageAction = { channelId?: string; message?: PollMessage & { channel_id?: string } };

type MessagesAction = { channelId?: string; messages?: PollMessage[] };

type MessageList = { toArray(): PollMessage[] };

type MessageStore = { getMessages(channelId: string): MessageList | undefined };

function revealer(Polls: PollStore) {
	return (channelId: string | undefined, messages: readonly (PollMessage | undefined)[]) => {
		if (!channelId) return;

		const now = Date.now();

		for (const message of messages) {
			if (!hidesResults(message, now) || Polls.getPollState(channelId, message!.id!))
				continue;

			Polls.updatePollState(channelId, message!.id!, (previous) => ({
				channelId,
				selectedAnswerIds: new Set(),
				submitting: false,
				editing: false,
				...previous,
				showResults: true,
			}));
		}
	};
}

/**
 * @description Shows the results of polls you haven't voted in, the way Discord's own Show results does, as their
 * messages arrive or load. Polls whose state you already changed, such as with Go back to vote, are left alone.
 * @returns A function that stops listening.
 */
export function listenToPolls(): () => void {
	const Polls = metro.findByFilePath('modules/polls/PollsInteractionStore.tsx') as
		| PollStore
		| undefined;

	if (typeof Polls?.updatePollState !== 'function' || typeof Polls.getPollState !== 'function') {
		logger.warn('Poll results skipped: Discord moved PollsInteractionStore.');

		return () => undefined;
	}

	const reveal = revealer(Polls);
	const Messages = flux.getStore('Message') as unknown as MessageStore;
	const selected = flux.getStore('SelectedChannel').getChannelId?.() as string | undefined;

	if (selected) reveal(selected, Messages.getMessages(selected)?.toArray() ?? []);

	const stops = [
		flux.onAction('MESSAGE_CREATE', (action) => {
			const { channelId, message } = action as MessageAction;

			reveal(channelId ?? message?.channel_id, [message]);
		}),
		flux.onAction('LOAD_MESSAGES_SUCCESS', (action) => {
			const { channelId, messages = [] } = action as MessagesAction;

			reveal(channelId, messages);
		}),
	];

	return () => {
		for (const stop of stops) stop();
	};
}
