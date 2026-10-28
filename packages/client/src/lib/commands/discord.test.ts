import { describe, expect, test } from 'bun:test';

import type { IndexSection, IndexState } from './discord';
import { isOverridableDenial, toDiscordCommand, withSections } from './discord';
import { normalize } from './normalize';
import { option } from './options';

const HasAccessResult = {
	ALLOWED: 0,
	NSFW_NOT_ALLOWED: 1,
	WRONG_COMMAND_TYPE: 2,
	PREDICATE_FAILED: 3,
	CONTEXT_NOT_ALLOWED: 4,
	MISSING_BASE_PERMISSIONS: 5,
	CHANNEL_DENIED: 6,
	USER_DENIED: 7,
};

const added: Record<string, IndexSection> = {
	unbound: { descriptor: { id: 'unbound', type: 0, name: 'Unbound' }, commands: {} },
};

async function execute() {
	return undefined;
}

describe('withSections', () => {
	test('keeps a stale state stale so Discord still fetches', () => {
		const stale: IndexState = { serverVersion: 3, fetchState: { fetching: false } };
		const state = withSections(stale, added);

		expect(state.result?.sections).toEqual(added);
		expect(state.result?.version).not.toBe(stale.serverVersion);
		expect(stale.result).toBeUndefined();
	});

	test("adds sections next to Discord's own", () => {
		const fresh: IndexState = {
			serverVersion: 3,
			fetchState: {},
			result: { sections: { bot: added.unbound }, sectionIdsByBotId: {}, version: 3 },
		};

		expect(Object.keys(withSections(fresh, added).result?.sections ?? {})).toEqual([
			'bot',
			'unbound',
		]);
		expect(withSections(fresh, {})).toBe(fresh);
	});
});

describe('isOverridableDenial', () => {
	test('overrides permission denials only', () => {
		const overridden = Object.values(HasAccessResult).filter((result) =>
			isOverridableDenial(result, HasAccessResult),
		);

		expect(overridden).toEqual([4, 5, 6, 7]);
	});
});

describe('toDiscordCommand', () => {
	test('maps a subcommand leaf with its path, section and choices', () => {
		const [record] = normalize({
			owner: 'demo',
			section: { id: 'unbound:demo', name: 'Demo', icon: undefined },
			tree: {
				tag: {
					description: 'Tags',
					subcommands: {
						add: {
							description: 'Add a tag',
							options: {
								kind: option.choice([{ label: 'Pinned', value: 'pin' }], {
									required: true,
								}),
							},
							execute,
						},
					},
				},
			},
		});
		const command = toDiscordCommand(record, execute);

		expect(command).toMatchObject({
			untranslatedName: 'tag add',
			applicationId: 'unbound:demo',
			subCommandPath: [{ name: 'add', type: 1 }],
			rootCommand: { id: record.rootId, untranslatedName: 'tag', displayDescription: 'Tags' },
			options: [
				{
					name: 'kind',
					type: 3,
					required: true,
					choices: [{ name: 'Pinned', displayName: 'Pinned', value: 'pin' }],
				},
			],
		});
	});
});
