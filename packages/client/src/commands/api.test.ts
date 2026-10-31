import { afterEach, describe, expect, test } from 'bun:test';

import { createCommands, register, unregister } from './api';
import { CommandDefinitionError } from './normalize';
import { registry } from './registry';

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
			ping: { description: 'Ping', execute: run },
			tag: {
				description: 'Tags',
				subcommands: {
					add: { description: 'Add a tag', execute: run },
					remove: { description: 'Remove a tag', execute: run },
				},
			},
		});

		expect(listed()).toEqual([
			'unbound /ping: Ping',
			'unbound /tag add: Add a tag',
			'unbound /tag remove: Remove a tag',
		]);
	});

	test('the remover register returns removes that call only, and is harmless twice', () => {
		const removePing = register({ ping: { description: 'Ping', execute: run } });

		register({ tag: { description: 'Tag', execute: run } });
		removePing();
		removePing();

		expect(listed()).toEqual(['unbound /tag: Tag']);
	});

	test('unregister removes a root with its subcommands, and is harmless when absent', () => {
		register({
			ping: { description: 'Ping', execute: run },
			tag: {
				description: 'Tags',
				subcommands: { add: { description: 'Add a tag', execute: run } },
			},
		});

		unregister('tag');
		const version = registry.snapshot().version;

		unregister('tag');
		unregister('missing');

		expect(listed()).toEqual(['unbound /ping: Ping']);
		expect(registry.snapshot().version).toBe(version);
	});

	test('registering a root again replaces it', () => {
		register({ ping: { description: 'Old', execute: run } });
		register({ ping: { description: 'New', execute: run } });

		expect(listed()).toEqual(['unbound /ping: New']);
	});

	test('a root a built-in has throws, and unregister leaves the built-in alone', () => {
		builtIns.register({ eval: { description: 'Eval', execute: run } });

		expect(() => register({ eval: { description: 'Mine', execute: run } })).toThrow(
			CommandDefinitionError,
		);

		unregister('eval');

		expect(listed()).toEqual(['unbound /eval: Eval']);
	});
});
