import { installAddonGlobals } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, mock, test } from 'bun:test';

type Author = { id: string; username: string };
type MessageRecord = { id: string; channel_id: string; type: number; author: Author };
type Row = { message: { timestamp: string; timestampAccessibilityLabel: string } };

const stores: Record<string, object> = {
	Channel: { getChannel: () => undefined },
	User: { getCurrentUser: () => ({ id: 'me' }) },
	UserProfile: { getUserProfile: () => undefined, getGuildMemberProfile: () => undefined },
};

const scope = installAddonGlobals({
	manifest: { id: 'astral.pronoundb' },
	unbound: { flux: { getStore: (name: string) => stores[name] } },
});

Object.assign(scope.metro, {
	common: { ReactNative: { Dimensions: { get: () => ({ width: 375 }) } } },
});

const MessageRowData = {
	generateMessageRowData: (_data: { message: MessageRecord }): Row => ({
		message: { timestamp: '21:02', timestampAccessibilityLabel: '21:02' },
	}),
};

scope.metro.register(MessageRowData);

mock.module('@unbound-app/api', () => scope.unbound);

const { patchMessageRowData } = await import('~/patches/message-row-data');

const lookup = { get: () => 'he/him', dispose: () => {} };
const message: MessageRecord = {
	id: 'm1',
	channel_id: 'c1',
	type: 0,
	author: { id: 'u1', username: 'u1' },
};

function render() {
	return MessageRowData.generateMessageRowData({ message }).message;
}

beforeEach(() => {
	scope.patcher.unpatchAll();
});

describe('patchMessageRowData', () => {
	test("adds the pronouns to the header and leaves Discord's message unchanged", () => {
		const before = structuredClone(message);

		patchMessageRowData(lookup);

		expect(render().timestamp).toBe('21:02 • he/him');
		expect(message).toEqual(before);
	});

	test('headers built after removing it show no pronouns, with no relaunch', () => {
		const remove = patchMessageRowData(lookup);

		render();
		remove();

		expect(render()).toEqual({ timestamp: '21:02', timestampAccessibilityLabel: '21:02' });
	});
});
