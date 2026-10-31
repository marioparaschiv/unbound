import { installAddonGlobals } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, mock, test } from 'bun:test';

type Message = {
	id: string;
	channel_id: string;
	type: number;
	content: string;
	author: { id: string; username: string };
};
type Row = { message: { timestamp: string; timestampAccessibilityLabel: string } };
type Action = { type: string; message?: Message };

const stored = new Map<string, Message>();
const dispatched: Action[] = [];

const stores: Record<string, object> = {
	Channel: { getChannel: () => undefined },
	Message: { getMessage: (_channelId: string, id: string) => stored.get(id) },
	User: { getCurrentUser: () => ({ id: 'me' }) },
	UserProfile: { getUserProfile: () => undefined, getGuildMemberProfile: () => undefined },
};

const scope = installAddonGlobals({
	manifest: { id: 'astral.pronoundb' },
	unbound: {
		flux: {
			getStore: (name: string) => stores[name],
			dispatch: async (action: Action) => void dispatched.push(action),
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

function message(id: string, authorId: string): Message {
	return {
		id,
		channel_id: 'c1',
		type: 0,
		content: 'hi',
		author: { id: authorId, username: authorId },
	};
}

beforeEach(() => {
	stored.clear();
	dispatched.length = 0;
	scope.patcher.unpatchAll();
});

describe('patchMessageRowData', () => {
	test('adds the pronouns to the header while applied', () => {
		patchMessageRowData(lookup);

		const row = MessageRowData.generateMessageRowData({ message: message('m1', 'u1') });

		expect(row.message.timestamp).toBe('21:02 • he/him');
	});

	test('removing it has Discord rebuild each labelled row from the stored message', () => {
		const remove = patchMessageRowData(lookup);
		const edited = { ...message('m1', 'u1'), content: 'hi (edited)' };

		MessageRowData.generateMessageRowData({ message: message('m1', 'u1') });
		stored.set('m1', edited);
		remove();

		expect(dispatched).toMatchObject([{ type: 'MESSAGE_UPDATE', message: edited }]);
		expect(MessageRowData.generateMessageRowData({ message: edited }).message.timestamp).toBe(
			'21:02',
		);
	});

	test('removing it leaves rows it did not label alone', () => {
		const remove = patchMessageRowData(lookup);
		const joined = message('m2', 'me');

		stored.set('m2', joined);
		MessageRowData.generateMessageRowData({ message: { ...joined, type: 7 } });
		remove();

		expect(dispatched).toEqual([]);
	});
});
