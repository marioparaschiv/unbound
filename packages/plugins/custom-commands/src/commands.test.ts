import { expect, test } from 'bun:test';

import { appendSavedCommands, createCommand } from './commands';
import type { BuiltInCommand } from './commands';

const tags = [{ name: 'dope', message: 'lol', media: [] }];

async function send() {}

test('registers saved commands once in the chat-input query', () => {
	const results = [{ displayName: 'shrug' } as BuiltInCommand];

	appendSavedCommands([1], results, tags, send);
	appendSavedCommands([1], results, tags, send);

	expect(results.map((command) => command.displayName)).toEqual(['shrug', 'dope']);
});

test('does not register saved commands in other built-in queries', () => {
	const results: BuiltInCommand[] = [];

	appendSavedCommands([2], results, tags, send);

	expect(results).toEqual([]);
});

test('turns arguments into string options and adds an optional ephemeral switch', () => {
	const command = createCommand(
		{ name: 'greet', message: 'Hi {{user}}, {{mood = great}}', media: [] },
		send,
	);

	expect(command.id).toBe('-9098619145');
	expect(command.displayDescription).toBe('Send the greet command');
	expect(command.options.map(({ name, type, required }) => [name, type, required])).toEqual([
		['user', 3, true],
		['mood', 3, false],
		['ephemeral', 5, false],
	]);
});
