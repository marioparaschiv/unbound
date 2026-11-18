import { describe, expect, test } from 'bun:test';

import {
	breakingDiscordUpdate,
	isOlderThanSupported,
	parseDiscordVersion,
	shouldWarnAboutDiscordVersion,
	discordChannel,
} from '~/core/discord-support';

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
		expect(discordChannel('352.0', 'Sideloaded (TestFlight build)').channel).toBe('Beta');
	});
});

describe('breakingDiscordUpdate', () => {
	const scanned = [
		{ version: '356.0', channel: 'stable', broken: 3 },
		{ version: '355.4', channel: 'stable', broken: 1 },
		{ version: '354.2', channel: 'stable', broken: 0 },
		{ version: '357.0', channel: 'alpha', broken: 9 },
		{ version: '351.0', channel: 'stable', broken: 4 },
	];

	test('names the newest broken version on the running channel', () => {
		expect(breakingDiscordUpdate('352.10', 'Stable', scanned)).toBe('356.0');
	});

	test('ignores older, working and alpha versions', () => {
		expect(breakingDiscordUpdate('356.0', 'Stable', scanned)).toBeUndefined();
		expect(breakingDiscordUpdate('352.10', 'Alpha', scanned)).toBeUndefined();
		expect(breakingDiscordUpdate('352.10', 'Beta', scanned)).toBeUndefined();
	});
});
