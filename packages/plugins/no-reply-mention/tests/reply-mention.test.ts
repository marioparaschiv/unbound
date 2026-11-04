import { metro, startPlugin } from '@unbound-app/api/testing';
import { beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { settings } from '@unbound-app/settings';

// The testing kit fakes neither `ui` nor Discord's design components, which only the settings panel draws.
mock.module('~/settings', () => ({ default: () => null }));

type Reply = { message: { author: { id: string } }; shouldMention: boolean };

const listed = '100000000000000001';
const other = '100000000000000002';

const PendingReplyActions = {
	createPendingReply: (reply: Reply) => reply,
};

function createReply(authorId: string): Reply {
	return PendingReplyActions.createPendingReply({
		message: { author: { id: authorId } },
		shouldMention: true,
	});
}

beforeAll(() => {
	metro.register(PendingReplyActions);
});

beforeEach(async () => {
	await startPlugin();
});

describe('a new reply', () => {
	test('starts without mentioning its author', () => {
		expect(createReply(listed).shouldMention).toBe(false);
	});

	test('mentions a listed author when listed users may be pinged', () => {
		settings.userList = listed;
		settings.shouldPingListed = true;

		expect(createReply(listed).shouldMention).toBe(true);
		expect(createReply(other).shouldMention).toBe(false);
	});

	test('ignores the list while the option is off', () => {
		settings.userList = listed;

		expect(createReply(listed).shouldMention).toBe(false);
	});
});
