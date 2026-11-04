import { describe, expect, test } from 'bun:test';

import type { CommandMessageKey, CommandTree, OptionBuilders } from '../src/commands';

// The plugin's keys come from `fixtures/unbound-i18n.d.ts`, which mirrors the typings `ubd build` generates.
const keys: CommandMessageKey[] = ['COIN_FLIP', 'COIN_SIDE', 'COIN_HEADS', 'COIN_TAILS'];

function define<T>(tree: CommandTree<T>): CommandTree<T> {
	return tree;
}

// Only the types are under test; the SDK has no runtime for these builders, and `typeOnly` never runs.
declare const option: OptionBuilders;

function typeOnly() {
	define({
		coin: {
			description: 'COIN_FLIP',
			options: {
				side: option.choice(
					{ heads: 'COIN_HEADS', tails: 'COIN_TAILS' },
					{ description: 'COIN_SIDE', required: true },
				),
			},
			execute({ side }) {
				const value: 'heads' | 'tails' = side;
				// @ts-expect-error the handler gets only the map's values
				const other: 'edge' = side;

				return `${value}${other}`;
			},
		},
		// @ts-expect-error literal text where a message key is required
		literal: { description: 'Flip a coin', execute: () => 'x' },
		// @ts-expect-error a key the plugin's en-US.json does not have
		unknown: { description: 'COIN_EDGE', execute: () => 'x' },
		group: {
			description: 'COIN_FLIP',
			subcommands: {
				// @ts-expect-error literal text in a subcommand
				leaf: { description: 'Flip', execute: () => 'x' },
			},
		},
	});

	// @ts-expect-error literal text as an option description
	option.string({ description: 'The side' });
	// @ts-expect-error literal text as a choice label
	option.choice({ heads: 'Heads' });
	// @ts-expect-error an unknown key as a choice label
	option.choice({ heads: 'COIN_EDGE' });
	// @ts-expect-error the array form was removed
	option.choice(['heads', 'tails']);
	// @ts-expect-error Unbound's own keys are not the plugin's
	option.string({ description: 'UNBOUND_COMMAND_RELOAD_DESC' });
}

describe('plugin command types', () => {
	test("take the plugin's message keys", () => {
		expect(typeof typeOnly).toBe('function');
		expect(keys).toHaveLength(4);
	});
});
