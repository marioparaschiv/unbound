import { beforeEach, describe, expect, test } from 'bun:test';

import { chat, refreshChat } from './chat';

type Row = { type?: number };

function openChat(messages: Row[]) {
	const calls: string[] = [];

	chat.messages = messages;
	chat.rowManager = { generate: (message) => ({ type: (message.type ?? 0) + 100 }) };
	chat.chatManager = {
		setup: (rows) => calls.push(`setup:${[...rows].length}`),
		createRow: (row) => calls.push(`row:${row.type}`),
		createChangeset: () => ({ id: 'changeset' }),
	};
	chat.updatesQueue = {
		add: (changeset) => calls.push(`add:${(changeset as { id: string }).id}`),
		tryFlush: () => calls.push('flush'),
	};

	return calls;
}

beforeEach(() => {
	chat.chatManager = null;
	chat.rowManager = null;
	chat.messages = null;
	chat.updatesQueue = null;
});

describe('refreshChat', () => {
	test('rebuilds every row and flushes one changeset', () => {
		const calls = openChat([{ type: 0 }, { type: 1 }]);

		refreshChat();

		expect(calls).toEqual(['setup:2', 'row:100', 'row:101', 'add:changeset', 'flush']);
	});

	test('does nothing until a chat has been seen', () => {
		const calls = openChat([{ type: 0 }]);

		chat.updatesQueue = null;
		refreshChat();

		expect(calls).toEqual([]);
	});

	test('keeps the chat on globalThis across bundle evaluations', () => {
		expect(globalThis.__unboundNoBlockedMessagesRuntime).toBe(chat);
	});
});
