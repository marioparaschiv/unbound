import '../helpers/addons';
import '../helpers/core-messages';

import { describe, expect, test } from 'bun:test';

import { CommandDefinitionError } from '~/commands/normalize';
import { createOwnerCommands } from '~/commands/handle';
import { toDiscordCommand } from '~/commands/discord';
import { registry } from '~/commands/registry';
import { setLocale } from '~/i18n/locale';

import { createTestLocales, key } from '../helpers/command-locales';

const { coreLocales } = await import('~/commands/core-locales');
// Loaded after the helper's mocks: the scope reaches react-native, whose Flow source Bun cannot parse.
const { scopeCommands } = await import('~/addons/scoped-namespaces');

const tables = {
	'en-US': { COIN: 'Flip a coin' },
	de: { COIN: 'Wirf eine Münze' },
};

function pickerText(owner: string) {
	return registry
		.snapshot()
		.sections.flatMap((view) => view.commands)
		.filter((record) => record.owner === owner)
		.map((record) => toDiscordCommand(record, async () => undefined).displayDescription);
}

describe('a locale change', () => {
	test("re-resolves the picker data of the owner's commands, and stops following on unregisterAll", () => {
		const locales = createTestLocales(tables);
		const handle = createOwnerCommands('locale.demo', {}, () => locales);
		let changes = 0;
		const stop = registry.subscribe(() => changes++);

		handle.register({ coin: { description: key('COIN'), execute: () => 'x' } });
		const [before] = registry.snapshot().sections.flatMap((view) => view.commands);

		expect(pickerText('locale.demo')).toEqual(['Flip a coin']);
		expect(locales.listeners()).toBe(1);

		locales.setLocale('de');

		const [after] = registry.snapshot().sections.flatMap((view) => view.commands);

		expect(changes).toBe(2);
		expect(after).not.toBe(before);
		expect(after.id).toBe(before.id);
		expect(pickerText('locale.demo')).toEqual(['Wirf eine Münze']);

		handle.unregisterAll();
		stop();

		expect(locales.listeners()).toBe(0);
		expect(pickerText('locale.demo')).toEqual([]);
	});

	test("follows Unbound's core locale for its own commands", () => {
		let heard = 0;
		const stop = coreLocales.subscribe(() => heard++);

		setLocale('de');
		setLocale('en-US');
		stop();
		setLocale('de');

		expect(heard).toBe(2);
		expect(coreLocales.source('UNBOUND_COMMAND_RELOAD_DESC')).toBe('Reload Discord');
	});
});

describe("a plugin's scoped commands", () => {
	test('resolve through the locales the plugin scope supplies, its createCommands handles too', () => {
		const locales = createTestLocales(tables);
		const scoped = scopeCommands('locale.plugin', () => locales);
		const section = scoped.namespace.createCommands('locale.plugin.section', {
			section: { name: 'Plugin' },
		});

		scoped.namespace.register({ coin: { description: key('COIN'), execute: () => 'x' } });
		section.register({ flip: { description: key('COIN'), execute: () => 'x' } });
		locales.setLocale('de');

		expect(pickerText('locale.plugin')).toEqual(['Wirf eine Münze']);
		expect(pickerText('locale.plugin.section')).toEqual(['Wirf eine Münze']);

		scoped.dispose();

		expect(pickerText('locale.plugin')).toEqual([]);
		expect(pickerText('locale.plugin.section')).toEqual([]);
		expect(locales.listeners()).toBe(0);
	});

	test('throw naming the command when the plugin has no translations', () => {
		const scoped = scopeCommands('locale.none', () => undefined);

		expect(() =>
			scoped.namespace.register({ coin: { description: key('COIN'), execute: () => 'x' } }),
		).toThrow(
			new CommandDefinitionError(
				'locale.none',
				'coin',
				'the plugin has no translations. Add i18n/en-US.json with a key for each description.',
			),
		);
	});
});
