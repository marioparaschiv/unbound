import { describe, expect, test } from 'bun:test';

import {
	isOlderThanSupported,
	parseDiscordVersion,
	shouldWarnAboutDiscordVersion,
	discordChannel,
} from './discord-support';

describe('parseDiscordVersion', () => {
	test('reads the major and minor number', () => {
		expect(parseDiscordVersion('350.8')).toEqual([350, 8]);
		expect(parseDiscordVersion('352.10 - Beta')).toEqual([352, 10]);
	});

	test('rejects a version without numbers', () => {
		expect(parseDiscordVersion('')).toBeNull();
		expect(parseDiscordVersion('unknown')).toBeNull();
	});
});

describe('isOlderThanSupported', () => {
	test('compares the minor number as a number', () => {
		expect(isOlderThanSupported('350.9', '350.10')).toBe(true);
		expect(isOlderThanSupported('350.10', '350.9')).toBe(false);
	});

	test('accepts the minimum and anything newer', () => {
		expect(isOlderThanSupported('350.8 - Stable', '350.8')).toBe(false);
		expect(isOlderThanSupported('351.0', '350.8')).toBe(false);
		expect(isOlderThanSupported('349.20', '350.8')).toBe(true);
	});

	test('never flags a version it cannot read', () => {
		expect(isOlderThanSupported('', '350.8')).toBe(false);
		expect(isOlderThanSupported('349.0', '$$MINIMUM_DISCORD_ANDROID$$')).toBe(false);
	});
});

describe('shouldWarnAboutDiscordVersion', () => {
	test('warns once per unsupported version', () => {
		expect(shouldWarnAboutDiscordVersion('349.3', '350.8', '')).toBe(true);
		expect(shouldWarnAboutDiscordVersion('349.3', '350.8', '349.3')).toBe(false);
		expect(shouldWarnAboutDiscordVersion('349.4', '350.8', '349.3')).toBe(true);
	});

	test('never warns on a supported version', () => {
		expect(shouldWarnAboutDiscordVersion('350.8', '350.8', '')).toBe(false);
	});
});

describe('discordChannel', () => {
	test('reads the channel from the version suffix', () => {
		expect(discordChannel('352.10 - Beta')).toEqual({ channel: 'Beta', version: '352.10' });
		expect(discordChannel('353.0 - Alpha')).toEqual({ channel: 'Alpha', version: '353.0' });
		expect(discordChannel('351.0')).toEqual({ channel: 'Stable', version: '351.0' });
	});

	test('counts a TestFlight install as Beta', () => {
		expect(discordChannel('352.0', 'TestFlight')).toEqual({
			channel: 'Beta',
			version: '352.0',
		});
	});
});
