import type { CommandChannel, CommandTree, CommandUser } from '@unbound-app/types/commands';
import { describe, expect, test } from 'bun:test';

import { getKind, option } from './options';

function define<T>(tree: CommandTree<T>): CommandTree<T> {
	return tree;
}

describe('option builders', () => {
	test('type the handler args from the options record', () => {
		define({
			greet: {
				description: 'Greet someone',
				options: {
					user: option.user({ required: true }),
					where: option.channel(),
					style: option.choice(['wave', { label: 'High five', value: 'high-five' }]),
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
				description: 'A group',
				subcommands: {
					leaf: {
						description: 'A leaf',
						options: { name: option.string({ required: true }) },
						execute: ({ name }) => name.toUpperCase(),
					},
				},
			},
			// @ts-expect-error a group cannot also execute
			both: { description: 'Both', subcommands: {}, execute: () => 'x' },
		});

		// @ts-expect-error minLength is a string setting
		option.integer({ minLength: 1 });
	});

	test('mark options required only when asked', () => {
		expect(option.string().required).toBe(false);
		expect(option.string({ required: true }).required).toBe(true);
	});

	test('pick the choice kind from the listed values', () => {
		expect(option.choice(['a', 'b']).kind).toBe('string');
		expect(option.choice([1, 2]).kind).toBe('integer');
		expect(option.choice([1, 2.5]).kind).toBe('number');
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
