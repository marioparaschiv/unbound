import type { OptionSpec } from '@unbound-app/types/commands';
import { describe, expect, test } from 'bun:test';

import { CommandDefinitionError, normalize, resolveSection } from '~/commands/normalize';
import type { ErasedTree, Section } from '~/commands/normalize';
import { UNBOUND_ICON } from '~/commands/unbound-icon';
import { option } from '~/commands/options';

import { anyKeyLocales, createTestLocales, key } from '../helpers/command-locales';

const section: Section = { id: 'unbound', name: 'Unbound', icon: undefined };

function run() {
	return 'ok';
}

const tree: ErasedTree = {
	greet: {
		description: 'Greet someone',
		options: {
			style: option.choice({ wave: key('Wave'), 'high-five': key('High five') }),
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

function records(owner = 'unbound.demo', input: ErasedTree = tree, locales = anyKeyLocales) {
	return normalize({ owner, section, tree: input, locales });
}

// A spec in the removed array form, which only an untyped tree can hold.
type LegacySpec = Omit<OptionSpec, 'choices'> & { choices: readonly string[] };

function pick(choices: OptionSpec | LegacySpec) {
	return { pick: { description: 'd', options: { value: choices }, execute: run } };
}

describe('normalize', () => {
	test('flattens groups into leaves with their paths', () => {
		expect(records().map((record) => record.path)).toEqual([
			['greet'],
			['tag', 'add'],
			['tag', 'admin', 'purge'],
		]);
	});

	test('puts required options first and keeps choices in map order', () => {
		const [greet] = records();

		expect(greet.options.map((entry) => entry.name)).toEqual(['user', 'style']);
		expect(greet.options[1].choices).toEqual([
			{ label: 'Wave', value: 'wave' },
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
			pick(
				option.choice(
					Object.fromEntries(
						Array.from({ length: 26 }, (_, i) => [`c${i}`, key(`C${i}`)]),
					),
				),
			),
		],
		['duplicate choice labels', pick(option.choice({ a: key('A'), b: key('A') }))],
		[
			'the removed array choice form',
			pick({ ...option.choice({ a: key('A') }), choices: ['a'] }),
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

describe('normalize with translations', () => {
	const locales = createTestLocales({
		'en-US': {
			COIN: 'Flip a coin',
			SIDE: 'The side to call',
			HEADS: 'Heads',
			LONG: 'x'.repeat(101),
		},
	});

	function coin(description: string, side = 'SIDE', heads = 'HEADS'): ErasedTree {
		return {
			coin: {
				description,
				options: { side: option.choice({ heads: key(heads) }, { description: key(side) }) },
				execute: run,
			},
		};
	}

	test('keeps keys on the record, checked against en-US', () => {
		const [record] = records('demo', coin('COIN'), locales);

		expect(record.description).toBe('COIN');
		expect(record.options[0]).toMatchObject({
			description: 'SIDE',
			choices: [{ label: 'HEADS', value: 'heads' }],
		});
	});

	test.each([
		[
			'a missing description key',
			coin('NOPE'),
			'description "NOPE" is not a key in i18n/en-US.json',
		],
		[
			'literal text',
			coin('Flip a coin'),
			'description "Flip a coin" is not a key in i18n/en-US.json',
		],
		[
			'a missing option key',
			coin('COIN', 'NOPE'),
			'option "side" description "NOPE" is not a key',
		],
		[
			'a missing choice key',
			coin('COIN', 'SIDE', 'NOPE'),
			'option "side" choice "heads" label "NOPE" is not a key',
		],
		[
			'en-US text over 100 characters',
			coin('LONG'),
			'description LONG must be 1-100 characters in i18n/en-US.json, not 101',
		],
	])('rejects %s, naming the command and key', (_, input, reason) => {
		expect(() => records('demo', input, locales)).toThrow(
			`Invalid command "/coin" from demo: ${reason}`,
		);
	});
});

describe('resolveSection', () => {
	test('uses the shared section unless the owner names its own', () => {
		expect(resolveSection('unbound.demo', undefined).id).toBe('unbound');
		expect(resolveSection('unbound.demo', undefined).icon).toBe(UNBOUND_ICON);
		expect(resolveSection('unbound.demo', { name: ' Demo ' })).toEqual({
			id: 'unbound:unbound.demo',
			name: 'Demo',
			icon: undefined,
		});
	});
});
