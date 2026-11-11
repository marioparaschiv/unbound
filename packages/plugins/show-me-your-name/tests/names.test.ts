import { flux, logs, metro, startPlugin, stopPlugin } from '@unbound-app/api/testing';
import { settings } from '@unbound-app/settings';
import { beforeEach, describe, expect, test } from 'bun:test';

type Row = { username?: string; authorId?: string; referencedMessage?: { message?: Row } };
type Author = { id: string; username: string; globalName?: string };
type Message = { author: Author; type?: number; reply?: { author: Author } };

const alice: Author = { id: '1', username: 'alice99', globalName: 'Alice G' };
const bob: Author = { id: '2', username: 'bob42' };

const rowData = {
	// Discord builds the row from the message; the plugin relabels what comes out.
	generateMessageRowData: ({ message }: { message: Message }) => ({
		message: {
			username: message.author.username === 'alice99' ? 'Alice' : 'Bob',
			referencedMessage: message.reply
				? { message: { username: 'Bob', authorId: message.reply.author.id } }
				: undefined,
		} satisfies Row,
	}),
};

function rowFor(message: Message) {
	return rowData.generateMessageRowData({ message }).message;
}

beforeEach(async () => {
	flux.seed({
		Relationship: { getNickname: (id: string) => (id === '1' ? 'Ally' : null) },
		User: { getUser: (id: string) => [alice, bob].find((user) => user.id === id) },
	});
	metro.register(rowData);
	await startPlugin();
});

describe('the author label of a message', () => {
	test('shows the username next to the name Discord shows', () => {
		expect(rowFor({ author: bob }).username).toBe('Bob (@bob42)');
	});

	test('prefers a friend nickname', () => {
		expect(rowFor({ author: alice }).username).toBe('Ally (@alice99)');

		settings.friendNicknames = false;
		expect(rowFor({ author: alice }).username).toBe('Alice (@alice99)');
	});

	test('follows the display mode', () => {
		settings.mode = 'user-nick';
		expect(rowFor({ author: bob }).username).toBe('@bob42 (Bob)');

		settings.mode = 'user';
		expect(rowFor({ author: bob }).username).toBe('@bob42');
	});

	test('uses the global name instead of the username when asked', () => {
		settings.displayNames = true;
		settings.friendNicknames = false;

		expect(rowFor({ author: alice }).username).toBe('Alice (@Alice G)');
	});

	test('leaves AutoMod messages alone', () => {
		const row = rowFor({ author: bob, type: 24 });

		expect(row.username).toBe('Bob');
	});
});

describe('the reply preview', () => {
	const message = { author: alice, reply: { author: bob } };

	test('is left alone by default', () => {
		expect(rowFor(message).referencedMessage?.message?.username).toBe('Bob');
	});

	test('shows the username once Apply To Replies is on', () => {
		settings.inReplies = true;

		expect(rowFor(message).referencedMessage?.message?.username).toBe('Bob (@bob42)');
	});
});

describe('the plugin', () => {
	test('starts without a warning once it has patched the message rows', () => {
		expect(logs.entries.filter((entry) => entry.level !== 'info')).toEqual([]);
	});

	test('leaves the names as Discord shows them once it stops', async () => {
		await stopPlugin();

		expect(rowFor({ author: bob }).username).toBe('Bob');
	});
});
