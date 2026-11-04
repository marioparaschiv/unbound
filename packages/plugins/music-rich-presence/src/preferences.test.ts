import { describe, expect, test } from 'bun:test';

import { SETTINGS } from '~/constants';
import {
	canQuery,
	hasInvalidCustomInstance,
	normalizeBaseUrl,
	readPreferences,
} from '~/preferences';

function reader(values: Record<string, unknown>) {
	return <T>(key: string, def: T) => (key in values ? values[key] : def);
}

describe('readPreferences', () => {
	test('falls back to the defaults for an empty store', () => {
		expect(readPreferences(reader({}))).toEqual(SETTINGS);
	});

	test('rejects unknown choices and wrong types', () => {
		const preferences = readPreferences(
			reader({
				scrobblerBackend: 'spotify',
				nameFormat: 42,
				statusDisplayType: 'album',
				missingArt: null,
				showLogo: 'yes',
				username: 7,
			}),
		);

		expect(preferences.scrobblerBackend).toBe('lastfm');
		expect(preferences.nameFormat).toBe('status-name');
		expect(preferences.statusDisplayType).toBe('artist');
		expect(preferences.missingArt).toBe('logo');
		expect(preferences.showLogo).toBe(true);
		expect(preferences.username).toBe('');
	});

	test('keeps valid values and trims what the user typed', () => {
		const preferences = readPreferences(
			reader({
				scrobblerBackend: 'listenbrainz-compatible',
				instanceBaseURL: ' https://lb.example.org// ',
				instanceAPIBaseUrl: 'https://api.lb.example.org/',
				username: '  rini ',
				apiKey: ' key ',
				statusName: ' {title} ',
				useListeningStatus: true,
			}),
		);

		expect(preferences.scrobblerBackend).toBe('listenbrainz-compatible');
		expect(preferences.instanceBaseURL).toBe('https://lb.example.org');
		expect(preferences.instanceAPIBaseUrl).toBe('https://api.lb.example.org');
		expect(preferences.username).toBe('rini');
		expect(preferences.apiKey).toBe('key');
		expect(preferences.statusName).toBe(' {title} ');
		expect(preferences.useListeningStatus).toBe(true);
	});
});

describe('normalizeBaseUrl', () => {
	test('drops whitespace and trailing slashes', () => {
		expect(normalizeBaseUrl('  https://a.org///  ')).toBe('https://a.org');
		expect(normalizeBaseUrl('')).toBe('');
	});
});

describe('custom instance checks', () => {
	const base = { ...SETTINGS, username: 'rini' };

	test('needs both URLs only for the self-hosted backend', () => {
		expect(hasInvalidCustomInstance(base)).toBe(false);
		expect(
			hasInvalidCustomInstance({
				...base,
				scrobblerBackend: 'listenbrainz-compatible',
				instanceBaseURL: 'https://a.org',
			}),
		).toBe(true);
		expect(
			hasInvalidCustomInstance({
				...base,
				scrobblerBackend: 'listenbrainz-compatible',
				instanceBaseURL: 'https://a.org',
				instanceAPIBaseUrl: 'https://api.a.org',
			}),
		).toBe(false);
	});

	test('queries only with a username and a usable backend', () => {
		expect(canQuery(SETTINGS)).toBe(false);
		expect(canQuery(base)).toBe(true);
		expect(canQuery({ ...base, scrobblerBackend: 'listenbrainz-compatible' })).toBe(false);
	});
});
