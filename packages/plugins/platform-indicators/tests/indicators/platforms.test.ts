import { describe, expect, test } from 'bun:test';
import { readdirSync } from 'node:fs';

import { MESSAGE_LOCALES } from '~/constants';
import {
	describePlatforms,
	listLocale,
	isMobileShown,
	ownClientStatus,
	parseStatusesKey,
	platformGlyph,
	platformLabel,
	platformStatuses,
	statusesKey,
} from '~/indicators/platforms';

function session(client: string, status: string) {
	return { status, clientInfo: { client, os: 'x', version: 0 } };
}

describe('platformLabel', () => {
	test('uses the special labels and capitalises the rest', () => {
		expect(platformLabel('embedded')).toBe('Embedded (Console or Game)');
		expect(platformLabel('vr')).toBe('VR');
		expect(platformLabel('desktop')).toBe('Desktop');
		expect(platformLabel('mobile')).toBe('Mobile');
		expect(platformLabel('web')).toBe('Web');
	});
});

describe('ownClientStatus', () => {
	test('keeps the most present status of each client', () => {
		expect(
			ownClientStatus({
				a: session('desktop', 'online'),
				b: session('desktop', 'idle'),
				c: session('mobile', 'dnd'),
				d: session('mobile', 'idle'),
			}),
		).toEqual({ desktop: 'online', mobile: 'idle' });
	});

	test('skips unknown clients and sessions without a status', () => {
		expect(
			ownClientStatus({
				a: session('unknown', 'online'),
				b: { clientInfo: { client: 'web' } },
				c: session('web', 'dnd'),
			}),
		).toEqual({ web: 'dnd' });
	});

	test('returns null for unreadable sessions', () => {
		expect(ownClientStatus(undefined)).toBeNull();
		expect(ownClientStatus(null)).toBeNull();
		expect(ownClientStatus('x')).toBeNull();
	});

	test('reports the current device as online mobile when Discord lists no sessions', () => {
		expect(ownClientStatus({})).toEqual({ mobile: 'online' });
		expect(ownClientStatus({ a: session('unknown', 'online') })).toEqual({ mobile: 'online' });
	});
});

describe('platformStatuses', () => {
	test('lists each platform with a status in order', () => {
		expect(platformStatuses({ desktop: 'online', mobile: 'idle', web: undefined })).toEqual([
			{ platform: 'desktop', status: 'online' },
			{ platform: 'mobile', status: 'idle' },
		]);
		expect(platformStatuses(null)).toEqual([]);
	});

	test('round-trips through a key', () => {
		const statuses = platformStatuses({ embedded: 'dnd', vr: 'online' });

		expect(statusesKey(statuses)).toBe('embedded:dnd,vr:online');
		expect(parseStatusesKey(statusesKey(statuses))).toEqual(statuses);
		expect(parseStatusesKey('')).toEqual([]);
	});
});

describe('isMobileShown', () => {
	test('shows mobile for any mobile status unless online on desktop', () => {
		expect(isMobileShown({ mobile: 'online' })).toBe(true);
		expect(isMobileShown({ mobile: 'idle' })).toBe(true);
		expect(isMobileShown({ mobile: 'dnd', desktop: 'idle' })).toBe(true);
		expect(isMobileShown({ mobile: 'online', desktop: 'online' })).toBe(false);
		expect(isMobileShown({ desktop: 'online' })).toBe(false);
		expect(isMobileShown(null)).toBe(false);
	});
});

describe('describePlatforms', () => {
	test('lists the platforms in words', () => {
		expect(describePlatforms([{ platform: 'desktop', status: 'online' }], 'en-US')).toBe(
			'Online on Desktop',
		);
		expect(
			describePlatforms(
				[
					{ platform: 'desktop', status: 'online' },
					{ platform: 'mobile', status: 'idle' },
					{ platform: 'vr', status: 'dnd' },
				],
				'en-US',
			),
		).toBe('Online on Desktop, Mobile, and VR');
		expect(describePlatforms([], 'en-US')).toBe('');
	});

	test('joins in English when the plugin has no messages for the locale', () => {
		expect(
			describePlatforms(
				[
					{ platform: 'desktop', status: 'online' },
					{ platform: 'mobile', status: 'idle' },
				],
				'ar',
			),
		).toBe('Online on Desktop and Mobile');
	});
});

describe('platformGlyph', () => {
	test('falls back to the desktop symbol', () => {
		expect(platformGlyph('mobile')).toBe('📱');
		expect(platformGlyph('console')).toBe(platformGlyph('desktop'));
	});
});

describe('listLocale', () => {
	test('follows the user only for a locale the plugin ships', () => {
		expect(listLocale('de', ['en-US', 'de'])).toBe('de');
		expect(listLocale('fr', ['en-US', 'de'])).toBe('en-US');
	});

	test('names every locale in the i18n folder', () => {
		const files = readdirSync(`${import.meta.dir}/../../i18n`).map((name) =>
			name.replace('.json', ''),
		);

		expect(MESSAGE_LOCALES).toEqual(files.sort());
	});
});
