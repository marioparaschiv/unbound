import type { EphemeralReply, Reply } from '@unbound-app/types/commands';
import { describe, expect, test } from 'bun:test';

import type { AutocompleteAction, CommandEffects, DiscordContext, RawOption } from './run';
import type { ErasedArgs, ErasedTree, Section } from './normalize';
import { createExecute } from './run';
import { normalize } from './normalize';
import { option } from './options';

const section: Section = { id: 'unbound:demo', name: 'Demo', icon: undefined };
const context: DiscordContext = {
	channel: { id: 'c1', type: 0 },
	guild: { id: 'g1', name: 'Guild' },
};
const mario = { id: '1', username: 'mario' };

type Harness = {
	effects: CommandEffects;
	ephemeral: EphemeralReply[];
	actions: AutocompleteAction[];
	errors: unknown[];
};

function harness(): Harness {
	const ephemeral: EphemeralReply[] = [];
	const actions: AutocompleteAction[] = [];
	const errors: unknown[] = [];
	let nonce = 0;

	return {
		ephemeral,
		actions,
		errors,
		effects: {
			resolvers: {
				user: (id) => (id === mario.id ? mario : undefined),
				channel: () => undefined,
				role: () => undefined,
			},
			showEphemeral: (_, reply) => ephemeral.push(reply),
			dispatch: (action) => actions.push(action),
			nonce: () => String(++nonce),
			reportError: (_, error) => errors.push(error),
		},
	};
}

function command(tree: ErasedTree, effects: CommandEffects, leaf = 0) {
	return createExecute(normalize({ owner: 'demo', section, tree })[leaf], effects);
}

function greet(execute: (args: ErasedArgs) => Reply | Promise<Reply>): ErasedTree {
	return {
		greet: {
			description: 'Greet',
			options: {
				user: option.user({ required: true }),
				style: option.choice(['wave', { label: 'High five', value: 'high-five' }]),
				note: option.string(),
			},
			execute,
		},
	};
}

describe('createExecute', () => {
	test('passes parsed args to the handler', async () => {
		const { effects } = harness();
		let received: ErasedArgs | undefined;
		const execute = command(
			greet((args) => {
				received = args;
			}),
			effects,
		);

		await execute(
			[
				{ type: 6, name: 'user', value: '1' },
				{ type: 3, name: 'style', value: 'high-five' },
			],
			context,
		);

		expect(received).toEqual({ user: mario, style: 'high-five', note: undefined });
	});

	test('finds a subcommand leaf inside the nodes Discord wraps it in', async () => {
		const { effects } = harness();
		const execute = command(
			{
				tag: {
					description: 'Tags',
					subcommands: {
						add: {
							description: 'Add',
							options: { name: option.string({ required: true }) },
							execute: ({ name }) => `added ${String(name)}`,
						},
					},
				},
			},
			effects,
		);
		const raw: RawOption[] = [
			{ type: 1, name: 'add', options: [{ type: 3, name: 'name', value: 'todo' }] },
		];

		expect(await execute(raw, context)).toEqual({ content: 'added todo' });
	});

	test('returns a string reply for Discord to send', async () => {
		const { effects, ephemeral } = harness();
		const execute = command(
			greet(() => 'hi'),
			effects,
		);

		expect(await execute([{ type: 6, name: 'user', value: '1' }], context)).toEqual({
			content: 'hi',
		});
		expect(ephemeral).toEqual([]);
	});

	test('shows an ephemeral reply once and returns nothing', async () => {
		const { effects, ephemeral } = harness();
		const execute = command(
			greet(async () => ({ ephemeral: true, content: 'secret' })),
			effects,
		);

		expect(await execute([{ type: 6, name: 'user', value: '1' }], context)).toBeUndefined();
		expect(ephemeral).toEqual([{ ephemeral: true, content: 'secret' }]);
	});

	test('reports an unresolved user before the handler runs', async () => {
		const { effects, ephemeral } = harness();
		let ran = false;
		const execute = command(
			greet(() => {
				ran = true;
			}),
			effects,
		);

		await execute([{ type: 6, name: 'user', value: '404' }], context);

		expect(ran).toBe(false);
		expect(ephemeral).toEqual([
			{ ephemeral: true, content: "/greet failed: couldn't find the user for user." },
		]);
	});

	test.each([
		[
			'throws',
			() => {
				throw new Error('Kaboom.');
			},
		],
		[
			'rejects',
			async () => {
				await Promise.resolve();
				throw new Error('Kaboom.');
			},
		],
	])('shows one error message when the handler %s, and resolves', async (_, handler) => {
		const { effects, ephemeral, errors } = harness();
		const execute = command(greet(handler), effects);

		expect(await execute([{ type: 6, name: 'user', value: '1' }], context)).toBeUndefined();
		expect(ephemeral).toEqual([{ ephemeral: true, content: '/greet failed: Kaboom.' }]);
		expect(errors).toHaveLength(1);
	});
});

describe('autocomplete', () => {
	function lookup(complete: (query: string) => string[], ran: () => void): ErasedTree {
		return {
			lookup: {
				description: 'Look up',
				options: {
					name: option.string({ required: true, autocomplete: complete }),
					limit: option.integer(),
				},
				execute: ran,
			},
		};
	}

	const raw: RawOption[] = [
		{ type: 3, name: 'name', value: 'ap', focused: true },
		{ type: 4, name: 'limit', value: 2 },
	];
	const request: DiscordContext = { ...context, autocomplete: { name: 'name', query: 'ap' } };

	test('answers suggestions without running the handler', async () => {
		const { effects, actions } = harness();
		let ran = false;
		const execute = command(
			lookup(
				(query) =>
					['apple', 'apricot', 'banana'].filter((fruit) => fruit.startsWith(query)),
				() => {
					ran = true;
				},
			),
			effects,
		);

		expect(await execute(raw, request)).toBeUndefined();
		expect(ran).toBe(false);
		expect(actions).toEqual([
			{
				type: 'APPLICATION_COMMAND_AUTOCOMPLETE_REQUEST',
				nonce: '1',
				channelId: 'c1',
				query: 'ap',
				name: 'name',
				contextKey: 'limit=2\0',
			},
			{
				type: 'APPLICATION_COMMAND_AUTOCOMPLETE_RESPONSE',
				nonce: '1',
				choices: [
					{ name: 'apple', value: 'apple' },
					{ name: 'apricot', value: 'apricot' },
				],
			},
		]);
	});

	test('answers no suggestions when autocomplete throws', async () => {
		const { effects, actions, ephemeral } = harness();
		const execute = command(
			lookup(
				() => {
					throw new Error('offline');
				},
				() => {},
			),
			effects,
		);

		await execute(raw, request);

		expect(actions.map((action) => action.type)).toEqual([
			'APPLICATION_COMMAND_AUTOCOMPLETE_REQUEST',
			'APPLICATION_COMMAND_AUTOCOMPLETE_RESPONSE',
		]);
		expect(actions[1]).toMatchObject({ nonce: '1', choices: [] });
		expect(ephemeral).toEqual([]);
	});
});
