import type { CommandChannel, CommandTree, CommandUser } from '@unbound-app/types/commands';
import { describe, expect, test } from 'bun:test';

import { getKind, option } from '~/commands/options';

function define<T>(tree: CommandTree<T>): CommandTree<T> {
	return tree;
}

describe('option builders', () => {
	test('type the handler args from the options record', () => {
		define({
			greet: {
				description: 'UNBOUND_COMMAND_EVAL_DESC',
				options: {
					user: option.user({ required: true }),
					where: option.channel(),
					style: option.choice({
						wave: 'UNBOUND_COMMAND_RELOAD_DESC',
						'high-five': 'UNBOUND_COMMAND_DEBUG_DESC',
					}),
					count: option.integer({ required: true, minValue: 1 }),
				},
				execute({ user, where, style, count }) {
					const required: CommandUser = user;
					const total: number = count;
					// @ts-expect-error an optional option may be undefined
					const optional: CommandChannel = where;
					// @ts-expect-error a choice narrows to its listed values
					const other: 'bow' | undefined = style;
					const listed: 'wave' | 'high-five' | undefined = style;

					return `${required.id}${total}${optional.id}${other}${listed}`;
				},
			},
			nested: {
				description: 'UNBOUND_COMMAND_PLUGINS_DESC',
				subcommands: {
					leaf: {
						description: 'UNBOUND_COMMAND_THEMES_DESC',
						options: { name: option.string({ required: true }) },
						execute: ({ name }) => name.toUpperCase(),
					},
				},
			},
			// @ts-expect-error a group cannot also execute
			both: {
				description: 'UNBOUND_COMMAND_DEBUG_DESC',
				subcommands: {},
				execute: () => 'x',
			},
		});

		// @ts-expect-error minLength is a string setting
		option.integer({ minLength: 1 });
	});

	test('take message keys, never literal text', () => {
		define({
			// @ts-expect-error literal text where a command description key is required
			literal: { description: 'Flip a coin', execute: () => 'x' },
			// @ts-expect-error a key en-US.json does not have
			unknown: { description: 'UNBOUND_NO_SUCH_KEY', execute: () => 'x' },
		});

		// @ts-expect-error literal text as an option description
		option.string({ description: 'The code' });
		// @ts-expect-error literal text as a choice label
		option.choice({ heads: 'Heads' });
		// @ts-expect-error the array form was removed
		option.choice(['heads', 'tails']);
		// @ts-expect-error literal text as a choice option's description
		option.choice({ heads: 'UNBOUND_COMMAND_RELOAD_DESC' }, { description: 'Side' });
	});

	test('mark options required only when asked', () => {
		expect(option.string().required).toBe(false);
		expect(option.string({ required: true }).required).toBe(true);
	});

	test('make a string option from a choice map, keeping its order', () => {
		const choice = option.choice({
			heads: 'UNBOUND_COMMAND_RELOAD_DESC',
			tails: 'UNBOUND_COMMAND_DEBUG_DESC',
		});

		expect(choice.kind).toBe('string');
		expect(Object.keys(choice.choices ?? {})).toEqual(['heads', 'tails']);
	});
});

describe('kind table', () => {
	const context = { channel: { id: 'c', type: 0 }, guild: undefined };
	const resolvers = {
		user: (id: string) => (id === '1' ? { id, username: 'mario' } : undefined),
		channel: () => undefined,
		role: () => undefined,
	};

	function parse(kind: string, value: string | number | boolean) {
		return getKind(kind)?.parse({ value, context, resolvers });
	}

	test('coerces numeric strings for integer and number options', () => {
		expect(parse('integer', '42')).toBe(42);
		expect(parse('integer', 4.5)).toBeUndefined();
		expect(parse('number', '4.5')).toBe(4.5);
		expect(parse('number', 'abc')).toBeUndefined();
	});

	test('resolves id options through the resolvers', () => {
		expect(parse('user', '1')).toEqual({ id: '1', username: 'mario' });
		expect(parse('user', '2')).toBeUndefined();
	});

	test('has no row for kinds outside v1', () => {
		expect(getKind('attachment')).toBeUndefined();
		expect(getKind('toString')).toBeUndefined();
	});
});
