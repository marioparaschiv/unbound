import { describe, expect, test } from 'bun:test';

const { toDiscordEscapes } = await import('~/i18n/discord-escapes');

describe('toDiscordEscapes', () => {
	test('turns quoted braces into backslash escapes', () => {
		expect(toDiscordEscapes("Hello '{{'user'}}'!")).toBe('Hello \\{\\{user\\}\\}!');
	});

	test('reads two apostrophes as one, in and out of quotes', () => {
		expect(toDiscordEscapes("it''s '{it''s}'")).toBe("it's \\{it's\\}");
	});

	test('escapes a literal backslash', () => {
		expect(toDiscordEscapes('Type \\n for a line break')).toBe('Type \\\\n for a line break');
	});

	test('leaves placeholders and lone apostrophes alone', () => {
		expect(toDiscordEscapes("{count, plural, one {# file} other {# files}} isn't")).toBe(
			"{count, plural, one {# file} other {# files}} isn't",
		);
	});
});
