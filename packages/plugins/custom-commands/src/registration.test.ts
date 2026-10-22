import { expect, test } from 'bun:test';
import { appendSavedCommands } from '@custom-commands/registration';

const tags = [{ name: 'dope', message: 'lol', media: [] }];

test('registers saved commands in the composer chat-input query', () => {
	const results = [{ displayName: 'shrug' }];
	appendSavedCommands(
		[[1], true, false],
		results,
		() => tags,
		(tag) => ({ displayName: tag.name }),
	);
	expect(results.map((command) => command.displayName)).toEqual(['shrug', 'dope']);
	appendSavedCommands(
		[[1], true, false],
		results,
		() => tags,
		(tag) => ({ displayName: tag.name }),
	);
	expect(results.map((command) => command.displayName)).toEqual(['shrug', 'dope']);
});

test('does not register chat commands in other built-in queries', () => {
	const results: Array<{ displayName: string }> = [];
	appendSavedCommands(
		[[2], true, false],
		results,
		() => tags,
		(tag) => ({ displayName: tag.name }),
	);
	expect(results).toEqual([]);
});
