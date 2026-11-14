import { logs, metro, startPlugin, stopPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';

type Row = { type: number };

const BLOCKED = 2;
const shown: number[] = [];

class ChatManager {
	setup(_messages: unknown) {}

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

function openChat() {
	const chatManager = new ChatManager();
	const rowManager = new RowManager();

	chatManager.setup(messages);
	new ChatUpdatesQueue().add({});

	for (const message of messages) chatManager.createRow(rowManager.generate(message));

	chatManager.createChangeset();

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

		expect(logs.entries.filter((entry) => entry.level === 'warn')).toEqual([]);
	});

	test('shows them again in the open chat when the plugin stops', async () => {
		await startPlugin();
		openChat();
		shown.length = 0;
		await stopPlugin();

		expect(shown).toEqual([0, BLOCKED, 0]);
	});
});
