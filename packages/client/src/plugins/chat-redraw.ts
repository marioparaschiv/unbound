import { createLogger } from '@unbound-app/logger';

import { forcedChangeType } from '~/plugins/chat-change-type';
import { createPatcher } from '~/patcher/create-patcher';
import { findByName, findStore } from '~/metro/lookups';
import { dispatch } from '~/flux/api';

const Patcher = createPatcher('unbound::chat-redraw');
const logger = createLogger('Plugins', 'ChatRedraw');

const REDRAW_DELAY_MS = 150;
const FORCE_TIMEOUT_MS = 2000;

type ChatManagerPrototype = {
	createChangeset: (...args: never[]) => object;
	determineChangeType: (...args: never[]) => number;
};

type NewestMessage = { id: string; content?: string };

type OpenChat = { channelId: string; newest: NewestMessage; prototype: ChatManagerPrototype };

type SelectedChannelStore = { getChannelId?: () => string | undefined };

type MessagesStore = {
	getMessages?: (channelId: string) => { last?: () => NewestMessage | undefined } | undefined;
};

const REBUILD_ACTION: string = 'MESSAGE_UPDATE';

let scheduled: ReturnType<typeof setTimeout> | undefined;

function chatManagerPrototype(): ChatManagerPrototype | undefined {
	const ChatManager = findByName('ChatManager', { lazy: false }) as
		| { prototype?: Partial<ChatManagerPrototype> }
		| undefined;
	const prototype = ChatManager?.prototype;

	if (!prototype?.createChangeset || !prototype.determineChangeType) {
		return undefined;
	}

	return prototype as ChatManagerPrototype;
}

function newestMessage(channelId: string): NewestMessage | undefined {
	const store: MessagesStore | undefined = findStore('Message', { lazy: false });

	return store?.getMessages?.(channelId)?.last?.();
}

function forceNextChangeset(prototype: ChatManagerPrototype): () => void {
	const unpatches: (() => void)[] = [];
	const timeout = setTimeout(release, FORCE_TIMEOUT_MS);

	function release() {
		clearTimeout(timeout);

		for (const unpatch of unpatches.splice(0)) unpatch();
	}

	unpatches.push(
		Patcher.after(prototype, 'determineChangeType', ({ result }) => forcedChangeType(result)),
		Patcher.after(prototype, 'createChangeset', ({ result }) => {
			release();

			return result;
		}),
	);

	return release;
}

function openChat(): OpenChat | undefined {
	const selected: SelectedChannelStore | undefined = findStore('SelectedChannel', {
		lazy: false,
	});
	const channelId = selected?.getChannelId?.();
	const newest = channelId ? newestMessage(channelId) : undefined;
	const prototype = newest ? chatManagerPrototype() : undefined;

	if (!channelId || !newest || !prototype) {
		return undefined;
	}

	return { channelId, newest, prototype };
}

function redrawOpenChat(): void {
	scheduled = undefined;

	const chat = openChat();

	if (!chat) return;

	const { channelId, newest } = chat;
	const release = forceNextChangeset(chat.prototype);

	dispatch({
		type: REBUILD_ACTION,
		message: { id: newest.id, channel_id: channelId, content: newest.content ?? '' },
	}).catch((cause: Error) => {
		release();
		logger.warn(`Failed to redraw the rows of channel ${channelId}:`, cause);
	});
}

/**
 * @description Redraws every row of the open chat shortly after a plugin starts or stops, so rows built before the change
 * show its patches at once. Calls within the delay share one redraw; nothing is scheduled while no chat is open.
 */
export function scheduleChatRedraw(): void {
	if (!openChat()) return;

	clearTimeout(scheduled);
	scheduled = setTimeout(redrawOpenChat, REDRAW_DELAY_MS);
}
