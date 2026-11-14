import { beforeEach, describe, expect, test } from 'bun:test';

import { beginRebuild, chat, endRebuild, recordItem, refreshChat } from '~/lib/chat';

type Row = { type?: number };

const MESSAGES = { kind: 'channel messages' };

function openChat() {
	const calls: string[] = [];

	chat.rowManager = { generate: (item) => ({ type: (item.type ?? 0) + 100 }) };
	chat.chatManager = {
		setup: (messages) => {
			beginRebuild(messages);
			calls.push(`setup:${messages === MESSAGES}`);
		},
		createRow: (row) => calls.push(`row:${row.type}`),
		createChangeset: () => {
			endRebuild();

			return { id: 'changeset' };
		},
	};
	chat.updatesQueue = {
		add: (changeset) => calls.push(`add:${(changeset as { id: string }).id}`),
		tryFlush: () => calls.push('flush'),
	};

	return calls;
}

function discordRebuild(items: Row[]) {
	chat.chatManager!.setup(MESSAGES);

	for (const item of items) {
		recordItem(item, chat.rowManager!);
		chat.chatManager!.createRow(chat.rowManager!.generate(item));
	}

	chat.chatManager!.createChangeset();
}

beforeEach(() => {
	chat.chatManager = null;
	chat.rowManager = null;
	chat.messages = null;
	chat.updatesQueue = null;
	chat.items = [];
	chat.recording = false;
	chat.refreshing = false;
	chat.recordingManager = null;
});

describe('refreshChat', () => {
	test("replays Discord's last rebuild item for item, once", () => {
		const calls = openChat();

		discordRebuild([{ type: 0 }, { type: 1 }]);
		calls.length = 0;
		refreshChat();
		refreshChat();

		expect(calls).toEqual([
			'setup:true',
			'row:100',
			'row:101',
			'add:changeset',
			'flush',
			'setup:true',
			'row:100',
			'row:101',
			'add:changeset',
			'flush',
		]);
	});

	test('records only the items of the latest rebuild', () => {
		openChat();

		discordRebuild([{ type: 0 }, { type: 1 }]);
		discordRebuild([{ type: 2 }]);
		recordItem({ type: 9 }, chat.rowManager!);

		expect(chat.items).toEqual([{ type: 2 }]);
	});

	test('records each item once, and only from the manager that started', () => {
		openChat();
		chat.chatManager!.setup(MESSAGES);

		const message = { type: 0, content: { id: '1' } };
		const other = { generate: (item: Row) => item };

		recordItem(message, chat.rowManager!);
		recordItem({ type: 0, content: { id: '1' } }, chat.rowManager!);
		recordItem({ type: 0, content: { id: '2' } }, other);

		expect(chat.items).toEqual([message]);
	});

	test('does nothing until a chat has been seen', () => {
		const calls = openChat();

		chat.updatesQueue = null;
		discordRebuild([{ type: 0 }]);
		calls.length = 0;
		refreshChat();

		expect(calls).toEqual([]);
	});

	test('keeps the chat on globalThis across bundle evaluations', () => {
		expect(globalThis.__unboundClientSideBlockRuntime).toBe(chat);
	});
});
