import { describe, expect, test } from 'bun:test';

import { settings } from '@unbound-app/settings';

import { SETTINGS } from '../helpers/defaults';
import {
	canQuery,
	hasInvalidCustomInstance,
	normalizeBaseUrl,
	readPreferences,
} from '~/presence/preferences';

describe('readPreferences', () => {
	test('reads the defaults before any setting is changed', () => {
		expect(readPreferences(settings)).toMatchObject({
			scrobblerBackend: 'lastfm',
			username: '',
			statusName: 'some music',
			nameFormat: 'status-name',
			clickableLinks: true,
			useListeningStatus: false,
		});
	});

	test('trims what the user typed and drops trailing slashes', () => {
		settings.scrobblerBackend = 'listenbrainz-compatible';
		settings.instanceBaseURL = ' https://lb.example.org// ';
		settings.instanceAPIBaseUrl = 'https://api.lb.example.org/';
		settings.username = '  rini ';
		settings.apiKey = ' key ';
		settings.statusName = ' {title} ';
		settings.useListeningStatus = true;

		const preferences = readPreferences(settings);

		expect(preferences.scrobblerBackend).toBe('listenbrainz-compatible');
		expect(preferences.instanceBaseURL).toBe('https://lb.example.org');
		expect(preferences.instanceAPIBaseUrl).toBe('https://api.lb.example.org');
		expect(preferences.username).toBe('rini');
		expect(preferences.apiKey).toBe('key');
		expect(preferences.statusName).toBe('{title}');
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
