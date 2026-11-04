import { describe, expect, test } from 'bun:test';

import { isOverridableDenial, toDiscordCommand, withSections } from '~/commands/discord';
import type { IndexSection, IndexState } from '~/commands/discord';
import { normalize } from '~/commands/normalize';
import { option } from '~/commands/options';

import { createTestLocales, key } from '../helpers/command-locales';

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
	const locales = createTestLocales({
		'en-US': {
			TAG: 'Tags',
			TAG_ADD: 'Add a tag',
			KIND: 'The kind of tag',
			PINNED: 'Pinned',
			LOOSE: 'Loose',
		},
		de: { TAG: 'Tags verwalten', TAG_ADD: 'Tag hinzufügen', PINNED: 'Angeheftet' },
		fr: { TAG: 'Gérer les tags', KIND: 'Le type de tag', LOOSE: 'Libre' },
	});
	const [record] = normalize({
		owner: 'demo',
		section: { id: 'unbound:demo', name: 'Demo', icon: undefined },
		locales,
		tree: {
			tag: {
				description: 'TAG',
				subcommands: {
					add: {
						description: 'TAG_ADD',
						options: {
							kind: option.choice(
								{ pin: key('PINNED'), loose: key('LOOSE') },
								{ required: true, description: key('KIND') },
							),
							note: option.string(),
						},
						execute,
					},
				},
			},
		},
	});

	function inLocale(code: string) {
		locales.setLocale(code);

		return toDiscordCommand(record, execute);
	}

	test('maps a subcommand leaf with its path, section and choices', () => {
		expect(inLocale('en-US')).toMatchObject({
			untranslatedName: 'tag add',
			applicationId: 'unbound:demo',
			subCommandPath: [{ name: 'add', type: 1 }],
			rootCommand: { id: record.rootId, untranslatedName: 'tag', displayDescription: 'Tags' },
			untranslatedDescription: 'Add a tag',
			displayDescription: 'Add a tag',
			options: [
				{
					name: 'kind',
					type: 3,
					required: true,
					displayDescription: 'The kind of tag',
					choices: [
						{ name: 'Pinned', displayName: 'Pinned', value: 'pin' },
						{ name: 'Loose', displayName: 'Loose', value: 'loose' },
					],
				},
				{ name: 'note', description: 'note', displayDescription: 'note' },
			],
		});
	});

	test.each([
		['de', 'Tags verwalten', 'Tag hinzufügen', 'The kind of tag', ['Angeheftet', 'Loose']],
		['fr', 'Gérer les tags', 'Add a tag', 'Le type de tag', ['Pinned', 'Libre']],
		['ja', 'Tags', 'Add a tag', 'The kind of tag', ['Pinned', 'Loose']],
	])('shows %s text, falling back to en-US per key', (code, root, leaf, kind, labels) => {
		const command = inLocale(code);

		expect(command.rootCommand?.displayDescription).toBe(root);
		expect(command.displayDescription).toBe(leaf);
		expect(command.untranslatedDescription).toBe('Add a tag');
		expect(command.options[0].displayDescription).toBe(kind);
		expect(command.options[0].description).toBe('The kind of tag');
		expect(command.options[0].choices?.map((choice) => choice.displayName)).toEqual(labels);
		expect(command.options[0].choices?.map((choice) => choice.name)).toEqual([
			'Pinned',
			'Loose',
		]);
	});
});
