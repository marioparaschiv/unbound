import { describe, expect, test } from 'bun:test';

import type { ErasedTree, Section } from './normalize';

import { CommandDefinitionError, normalize, resolveSection } from './normalize';
import { option } from './options';

const section: Section = { id: 'unbound', name: 'Unbound', icon: undefined };

function run() {
	return 'ok';
}

const tree: ErasedTree = {
	greet: {
		description: 'Greet someone',
		options: {
			style: option.choice(['wave', { label: 'High five', value: 'high-five' }]),
			user: option.user({ required: true }),
		},
		execute: run,
	},
	tag: {
		description: 'Manage tags',
		subcommands: {
			add: { description: 'Add a tag', execute: run },
			admin: {
				description: 'Tag admin',
				subcommands: { purge: { description: 'Purge tags', execute: run } },
			},
		},
	},
};

function records(owner = 'unbound.demo', input: ErasedTree = tree) {
	return normalize({ owner, section, tree: input });
}

describe('normalize', () => {
	test('flattens groups into leaves with their paths', () => {
		expect(records().map((record) => record.path)).toEqual([
			['greet'],
			['tag', 'add'],
			['tag', 'admin', 'purge'],
		]);
	});

	test('puts required options first and labels choices', () => {
		const [greet] = records();

		expect(greet.options.map((entry) => entry.name)).toEqual(['user', 'style']);
		expect(greet.options[1].choices).toEqual([
			{ label: 'wave', value: 'wave' },
			{ label: 'High five', value: 'high-five' },
		]);
	});

	test('derives stable ids from the owner and path', () => {
		const first = records();
		const second = records();
		const other = records('unbound.other');
		const [greet, add, purge] = first;

		expect(second.map((record) => record.id)).toEqual(first.map((record) => record.id));
		expect(other[0].id).not.toBe(greet.id);
		expect(Number(greet.id)).toBeLessThan(-99);
		expect(add.rootId).toBe(purge.rootId);
		expect(new Set(first.map((record) => record.id)).size).toBe(3);
	});

	test.each([
		['an uppercase name', { Greet: { description: 'd', execute: run } }],
		['a name with spaces', { 'say hi': { description: 'd', execute: run } }],
		['an empty description', { greet: { description: '', execute: run } }],
		['a group that executes', { greet: { description: 'd', execute: run, subcommands: {} } }],
		['an empty group', { greet: { description: 'd', subcommands: {} } }],
		[
			'a tree four levels deep',
			{
				a: {
					description: 'd',
					subcommands: {
						b: {
							description: 'd',
							subcommands: {
								c: {
									description: 'd',
									subcommands: { d: { description: 'd', execute: run } },
								},
							},
						},
					},
				},
			},
		],
		[
			'26 choices',
			{
				pick: {
					description: 'd',
					options: {
						value: option.choice(Array.from({ length: 26 }, (_, i) => `c${i}`)),
					},
					execute: run,
				},
			},
		],
		[
			'duplicate choice labels',
			{
				pick: {
					description: 'd',
					options: { value: option.choice(['a', { label: 'a', value: 'b' }]) },
					execute: run,
				},
			},
		],
		[
			'an option not made by a builder',
			{
				pick: {
					description: 'd',
					options: { value: { kind: 'attachment' } },
					execute: run,
				},
			},
		],
	])('rejects %s', (_, input) => {
		expect(() => records('unbound.demo', input as ErasedTree)).toThrow(CommandDefinitionError);
	});
});

describe('resolveSection', () => {
	test('uses the shared section unless the owner names its own', () => {
		expect(resolveSection('unbound.demo', undefined).id).toBe('unbound');
		expect(resolveSection('unbound.demo', { name: ' Demo ' })).toEqual({
			id: 'unbound:unbound.demo',
			name: 'Demo',
			icon: undefined,
		});
	});
});
