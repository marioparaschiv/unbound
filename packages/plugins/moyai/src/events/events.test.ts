import { installAddonGlobals } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, mock, test } from 'bun:test';

type Listener = (action: object) => void;

const listeners = new Map<string, Set<Listener>>();
const SelectedChannelStore = { getChannelId: () => 'selected' };

function onAction(type: string, listener: Listener) {
	const set = listeners.get(type) ?? new Set();

	set.add(listener);
	listeners.set(type, set);

	return () => void set.delete(listener);
}

function dispatch(type: string, action: object) {
	for (const listener of listeners.get(type) ?? []) listener(action);
}

const scope = installAddonGlobals({
	manifest: { id: 'astral.moyai' },
	unbound: { flux: { getStore: () => SelectedChannelStore, onAction } },
});

mock.module('@unbound-app/api', () => scope.unbound);

const { subscribeMessages } = await import('~/events/message-create');
const { subscribeReactions } = await import('~/events/reaction-add');

let plays = 0;
const player = { play: async () => void plays++, dispose: () => {} };

beforeEach(() => {
	plays = 0;
	listeners.clear();
});

describe('subscribeMessages', () => {
	test('plays once per Moyai in a message received in the selected channel', async () => {
		subscribeMessages(player);
		dispatch('MESSAGE_CREATE', { channelId: 'selected', message: { content: '🗿 🗿' } });
		await Bun.sleep(400);

		expect(plays).toBe(2);
	});

	test('ignores other channels and the user’s own pending sends', async () => {
		subscribeMessages(player);
		dispatch('MESSAGE_CREATE', { channelId: 'other', message: { content: '🗿' } });
		dispatch('MESSAGE_CREATE', {
			channelId: 'selected',
			message: { content: '🗿', state: 'SENDING' },
		});
		await Bun.sleep(10);

		expect(plays).toBe(0);
	});

	test('stops listening once unsubscribed', async () => {
		subscribeMessages(player)();
		dispatch('MESSAGE_CREATE', { channelId: 'selected', message: { content: '🗿' } });
		await Bun.sleep(10);

		expect(plays).toBe(0);
	});
});

describe('subscribeReactions', () => {
	test('plays once per message and emoji within the dedupe window', () => {
		subscribeReactions(player);

		const reaction = { channelId: 'selected', messageId: 'm1', emoji: { name: '🗿' } };

		dispatch('MESSAGE_REACTION_ADD', reaction);
		dispatch('MESSAGE_REACTION_ADD', reaction);

		expect(plays).toBe(1);
	});
});
