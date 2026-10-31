import {
	createChatModel,
	createMessageStoreModel,
	type MessageStoreModel,
	type ModelMessage,
} from '@unbound-plugins/shared/messages/message-store-model';
import { installAddonGlobals } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, mock, test } from 'bun:test';

type Action = Parameters<MessageStoreModel['dispatch']>[0];
type Author = { id: string; username: string };
type Message = ModelMessage & { type: number; author: Author };
type Row = { message: { timestamp: string; timestampAccessibilityLabel: string } };

let store = createMessageStoreModel('me');
const dispatched: Action[] = [];

const stores: Record<string, object> = {
	Channel: { getChannel: () => undefined },
	Message: { getMessage: (channelId: string, id: string) => store.getMessage(channelId, id) },
	User: { getCurrentUser: () => ({ id: 'me' }) },
	UserProfile: { getUserProfile: () => undefined, getGuildMemberProfile: () => undefined },
};

const scope = installAddonGlobals({
	manifest: { id: 'astral.pronoundb' },
	unbound: {
		flux: {
			getStore: (name: string) => stores[name],
			dispatch: (action: Action) => {
				dispatched.push(action);

				return store.dispatch(action);
			},
		},
	},
});

Object.assign(scope.metro, {
	common: { ReactNative: { Dimensions: { get: () => ({ width: 375 }) } } },
});

const MessageRowData = {
	generateMessageRowData: (_data: { message: Message }): Row => ({
		message: { timestamp: '21:02', timestampAccessibilityLabel: '21:02' },
	}),
};

scope.metro.register(MessageRowData);

mock.module('@unbound-app/api', () => scope.unbound);

const { patchMessageRowData } = await import('~/patches/message-row-data');

const lookup = { get: () => 'he/him', dispose: () => {} };

function chat(id: string, authorId: string, type = 0) {
	const author = { id: authorId, username: authorId };

	return createChatModel(store, [['c1', id]], (message) =>
		MessageRowData.generateMessageRowData({ message: { ...message, type, author } }),
	);
}

function flush() {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
	store = createMessageStoreModel('me');
	dispatched.length = 0;
	scope.patcher.unpatchAll();
});

describe('patchMessageRowData', () => {
	test('adds the pronouns to the header while applied', () => {
		patchMessageRowData(lookup);
		store.add({ id: 'm1', channel_id: 'c1', content: 'hi' });

		expect(chat('m1', 'u1').rows()[0]?.message.timestamp).toBe('21:02 • he/him');
	});

	test('removing it has Discord build the header without pronouns, and keeps the message as it was', async () => {
		const remove = patchMessageRowData(lookup);
		const before = store.add({
			id: 'm1',
			channel_id: 'c1',
			content: '<@me> hi',
			mentions: [{ id: 'me' }],
			embeds: [{ title: 'Title', description: 'Text' }],
		});
		const view = chat('m1', 'u1');

		expect(view.rows()[0]?.message.timestamp).toBe('21:02 • he/him');

		remove();
		await flush();

		const after = store.getMessage('c1', 'm1');

		expect(view.rows()[0]?.message.timestamp).toBe('21:02');
		expect(after).toEqual(before);
		expect(after?.mentioned).toBe(true);
		expect(after?.embeds).toEqual([{ rawTitle: 'Title', rawDescription: 'Text' }]);
	});

	test('removing it leaves rows it did not label alone', () => {
		const remove = patchMessageRowData(lookup);

		store.add({ id: 'm2', channel_id: 'c1', content: 'joined' });
		chat('m2', 'me', 7).rows();
		remove();

		expect(dispatched).toEqual([]);
	});
});
