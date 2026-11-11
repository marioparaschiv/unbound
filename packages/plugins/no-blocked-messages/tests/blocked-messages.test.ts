import { metro, startPlugin, stopPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';

import { selfTest } from '~/index';

type Row = { type: number };

const BLOCKED = 2;
const shown: number[] = [];

class ChatManager {
	setup(_messages: Iterable<Row>) {}

	createRow(row: Row) {
		shown.push(row.type);
	}

	createChangeset() {
		return {};
	}
}

class RowManager {
	generate(message: Row) {
		return message;
	}
}

class ChatUpdatesQueue {
	add(_changeset: object) {}
	tryFlush() {}
}

const messages: Row[] = [{ type: 0 }, { type: BLOCKED }, { type: 0 }];

// Discord opens a chat by building its rows through these three classes.
function openChat() {
	const chatManager = new ChatManager();
	const rowManager = new RowManager();

	chatManager.setup(messages);
	new ChatUpdatesQueue().add({});

	for (const message of messages) chatManager.createRow(rowManager.generate(message));

	return chatManager;
}

beforeEach(() => {
	shown.length = 0;
	metro.register(ChatManager);
	metro.register(RowManager);
	metro.register(ChatUpdatesQueue);
});

describe('blocked messages', () => {
	test('leaves out the rows that stand in for blocked messages', async () => {
		await startPlugin();
		openChat();

		expect(shown).toEqual([0, 0]);
	});

	test('reports itself applied once started', async () => {
		await startPlugin();

		expect(selfTest().ok).toBe(true);
	});

	test('shows them again in the open chat when the plugin stops', async () => {
		await startPlugin();
		openChat();
		shown.length = 0;
		await stopPlugin();

		expect(shown).toEqual([0, BLOCKED, 0]);
	});
});
