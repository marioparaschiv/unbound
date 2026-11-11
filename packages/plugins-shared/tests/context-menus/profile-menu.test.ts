import { describe, expect, mock, test } from 'bun:test';

type Messages = Record<string, string>;

// Discord's `t` maps a message id to a message, which `intl` formats in the user's language.
const i18n: {
	t: Messages;
	intl: { formatToPlainString: (message: string) => string | undefined };
} = {
	t: {},
	intl: { formatToPlainString: (message) => german[message] },
};
let german: Messages = {};

// The kit's fake needs the plugin preset the shared package runs without, so a stand-in Discord i18n module is enough here.
mock.module('@unbound-app/api', () => ({ metro: { common: { i18n } } }));

const { default: isProfileMenu } = await import('~/context-menus/profile-menu');

function registerMessages(messages: Messages) {
	german = messages;
	i18n.t = Object.fromEntries(Object.keys(messages).map((id) => [id, id]));
}

describe('the overflow menu of a profile', () => {
	test("is recognized by Discord's own wording, whatever the language", () => {
		registerMessages({ y5MwJy: 'Benutzernamen kopieren' });

		expect(isProfileMenu([{ label: 'Benutzernamen kopieren' }])).toBe(true);
	});

	test('is recognized by the English label when Discord has no such message', () => {
		registerMessages({});

		expect(isProfileMenu([{ label: 'Copy User ID' }])).toBe(true);
		expect(isProfileMenu([{ label: 'Set Friend Nickname' }])).toBe(true);
		expect(isProfileMenu([{ label: 'Report' }])).toBe(true);
	});

	test('is not recognized by rows of another menu', () => {
		registerMessages({ y5MwJy: 'Benutzernamen kopieren' });

		expect(isProfileMenu([{ label: 'Something else' }])).toBe(false);
		expect(isProfileMenu(undefined)).toBe(false);
	});
});
