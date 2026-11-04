import '../helpers/core-messages';

import { afterEach, describe, expect, test } from 'bun:test';

import { CommandDefinitionError } from '~/commands/normalize';
import { registry } from '~/commands/registry';

const { createCommands, register, unregister } = await import('~/commands/api');

function run() {
	return 'ok';
}

function listed() {
	return registry
		.snapshot()
		.sections.flatMap(({ section, commands }) =>
			commands.map(
				(record) => `${section.id} /${record.path.join(' ')}: ${record.description}`,
			),
		);
}

const builtIns = createCommands('unbound');

afterEach(() => {
	for (const name of ['ping', 'tag', 'eval']) {
		unregister(name);
	}

	builtIns.unregisterAll();
});

describe('commands namespace', () => {
	test('register lists commands in the shared Unbound section', () => {
		register({
			ping: { description: 'UNBOUND_COMMAND_RELOAD_DESC', execute: run },
			tag: {
				description: 'UNBOUND_COMMAND_PLUGINS_DESC',
				subcommands: {
					add: { description: 'UNBOUND_COMMAND_DEBUG_DESC', execute: run },
					remove: { description: 'UNBOUND_COMMAND_THEMES_DESC', execute: run },
				},
			},
		});

		expect(listed()).toEqual([
			'unbound /ping: UNBOUND_COMMAND_RELOAD_DESC',
			'unbound /tag add: UNBOUND_COMMAND_DEBUG_DESC',
			'unbound /tag remove: UNBOUND_COMMAND_THEMES_DESC',
		]);
	});

	test('the remover register returns removes that call only, and is harmless twice', () => {
		const removePing = register({
			ping: { description: 'UNBOUND_COMMAND_RELOAD_DESC', execute: run },
		});

		register({ tag: { description: 'UNBOUND_COMMAND_DEBUG_DESC', execute: run } });
		removePing();
		removePing();

		expect(listed()).toEqual(['unbound /tag: UNBOUND_COMMAND_DEBUG_DESC']);
	});

	test('unregister removes a root with its subcommands, and is harmless when absent', () => {
		register({
			ping: { description: 'UNBOUND_COMMAND_RELOAD_DESC', execute: run },
			tag: {
				description: 'UNBOUND_COMMAND_PLUGINS_DESC',
				subcommands: { add: { description: 'UNBOUND_COMMAND_DEBUG_DESC', execute: run } },
			},
		});

		unregister('tag');
		const version = registry.snapshot().version;

		unregister('tag');
		unregister('missing');

		expect(listed()).toEqual(['unbound /ping: UNBOUND_COMMAND_RELOAD_DESC']);
		expect(registry.snapshot().version).toBe(version);
	});

	test('registering a root again replaces it', () => {
		register({ ping: { description: 'UNBOUND_COMMAND_RELOAD_DESC', execute: run } });
		register({ ping: { description: 'UNBOUND_COMMAND_DEBUG_DESC', execute: run } });

		expect(listed()).toEqual(['unbound /ping: UNBOUND_COMMAND_DEBUG_DESC']);
	});

	test('a root a built-in has throws, and unregister leaves the built-in alone', () => {
		builtIns.register({ eval: { description: 'UNBOUND_COMMAND_EVAL_DESC', execute: run } });

		expect(() =>
			register({ eval: { description: 'UNBOUND_COMMAND_DEBUG_DESC', execute: run } }),
		).toThrow(CommandDefinitionError);

		unregister('eval');

		expect(listed()).toEqual(['unbound /eval: UNBOUND_COMMAND_EVAL_DESC']);
	});

	test('a key missing from en-US throws, naming the command and the key', () => {
		expect(() =>
			// @ts-expect-error a key Unbound's en-US.json does not have
			register({ ping: { description: 'UNBOUND_NO_SUCH_KEY', execute: run } }),
		).toThrow(
			'Invalid command "/ping" from unbound::namespace: description "UNBOUND_NO_SUCH_KEY" is not a key',
		);
	});

	test('literal text is a type error and a runtime error', () => {
		expect(() =>
			// @ts-expect-error literal text where a message key is required
			register({ ping: { description: 'Ping the bot', execute: run } }),
		).toThrow(CommandDefinitionError);
	});
});
