import type { AddonVersion } from '@unbound-app/contracts/addons';
import { describe, expect, test } from 'bun:test';

import { toRelease, toVersionChoices } from './addon-versions';

const ID = 'dev.alpha';

function version(semver: string, min?: string): AddonVersion {
	return {
		version: semver,
		manifest: {
			id: ID,
			name: 'Alpha',
			description: 'An addon.',
			authors: [{ name: 'Mario', id: '1234567890' }],
			version: semver,
			main: 'index.js',
			type: 'plugin',
			...(min ? { unbound: { min } } : {}),
		},
		changelog: `Changes in ${semver}.`,
		changes: null,
		source: null,
		bundleSize: 10,
		sha256: 'a'.repeat(64),
		publishedAt: '2026-10-01T00:00:00.000Z',
		manifestUrl: `https://cdn.example.com/addons/${ID}/${semver}/manifest.json`,
		bundleUrl: `https://cdn.example.com/addons/${ID}/${semver}/index.js`,
	};
}

function summarize(versions: AddonVersion[], installed: string | undefined, client: string) {
	return toVersionChoices(versions, installed, client).map((choice) => {
		switch (choice.type) {
			case 'available':
				return [choice.version.version, choice.type, choice.latest, choice.holds];
			case 'installed':
				return [choice.version.version, choice.type, choice.latest];
			case 'incompatible':
				return [choice.version.version, choice.type, choice.requires];
		}
	});
}

describe('toVersionChoices', () => {
	test('marks the newest version latest and every older one as holding updates', () => {
		const versions = [version('2.0.0'), version('1.1.0'), version('1.0.0')];

		expect(summarize(versions, undefined, '1.0.0')).toEqual([
			['2.0.0', 'available', true, false],
			['1.1.0', 'available', false, true],
			['1.0.0', 'available', false, true],
		]);
	});

	test('marks the installed version and leaves it unpickable', () => {
		const versions = [version('2.0.0'), version('1.0.0')];

		expect(summarize(versions, '2.0.0', '1.0.0')).toEqual([
			['2.0.0', 'installed', true],
			['1.0.0', 'available', false, true],
		]);
		expect(summarize(versions, '1.0.0', '1.0.0')).toEqual([
			['2.0.0', 'available', true, false],
			['1.0.0', 'installed', false],
		]);
	});

	test('rules out versions that need a newer client, so latest is the newest it can run', () => {
		const versions = [version('3.0.0', '2.0.0'), version('2.0.0', '1.5.0'), version('1.0.0')];

		expect(summarize(versions, undefined, '1.5.0')).toEqual([
			['3.0.0', 'incompatible', '2.0.0'],
			['2.0.0', 'available', true, false],
			['1.0.0', 'available', false, true],
		]);
	});

	test('treats a release client as newer than its prereleases', () => {
		const versions = [version('2.0.0', '1.5.0-beta.2'), version('1.0.0')];

		expect(summarize(versions, undefined, '1.5.0-beta.1')).toEqual([
			['2.0.0', 'incompatible', '1.5.0-beta.2'],
			['1.0.0', 'available', true, false],
		]);
		expect(summarize(versions, undefined, '1.5.0')).toEqual([
			['2.0.0', 'available', true, false],
			['1.0.0', 'available', false, true],
		]);
	});

	test('keeps an installed version installed even when this client could not install it now', () => {
		const versions = [version('2.0.0', '9.0.0'), version('1.0.0')];

		expect(summarize(versions, '2.0.0', '1.0.0')).toEqual([
			['2.0.0', 'installed', false],
			['1.0.0', 'available', true, false],
		]);
	});
});

describe('toRelease', () => {
	test('carries what a manager needs to fetch and verify the version', () => {
		const listed = version('1.2.0');

		expect(toRelease(ID, listed)).toEqual({
			id: ID,
			version: '1.2.0',
			manifestUrl: listed.manifestUrl,
			bundleUrl: listed.bundleUrl,
			sha256: listed.sha256,
			changelog: 'Changes in 1.2.0.',
			changes: null,
		});
	});
});
