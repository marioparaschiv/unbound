import { describe, expect, test } from 'bun:test';

import type { AddonLocales } from '~/i18n/addon-locales';

const { createMessageResolver } = await import('~/i18n/message-resolver');
const { createAddonLocales } = await import('~/i18n/addon-locales');

function localesOf(table: Record<string, string>): AddonLocales {
	return createAddonLocales(
		table,
		{ owner: 'resolver.test', codes: [], read: async () => '{}' },
		(messages, key, vars) => (messages[key] ?? key).replace('{name}', String(vars?.name)),
	);
}

describe('a plugin message resolver', () => {
	test('serves toasts, dialogs and commands from one resolveMessage over the plugin locales', () => {
		const held: { locales?: AddonLocales } = {};
		const resolver = createMessageResolver('resolver.test', () => held.locales);

		expect(resolver.commandLocales()).toBeUndefined();
		expect(resolver.resolveMessage('HELLO')).toBe('HELLO');

		held.locales = localesOf({ HELLO: 'Hello, {name}!', PING: 'Ping' });

		const commands = resolver.commandLocales();

		expect(resolver.resolveMessage('HELLO', { name: 'Wumpus' })).toBe('Hello, Wumpus!');
		expect(resolver.takesVars('HELLO')).toBe(true);
		expect(resolver.takesVars('PING')).toBe(false);
		expect(commands?.text('PING')).toBe(resolver.resolveMessage('PING'));
		expect(commands?.source('PING')).toBe('Ping');
		expect(commands?.source('MISSING')).toBeUndefined();
	});
});
