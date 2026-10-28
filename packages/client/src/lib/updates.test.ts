import type { AddonUpdate } from '@unbound-app/contracts/updates';
import { describe, expect, test } from 'bun:test';

import type { InstalledEntry, UpdatableKind } from './updates';

import { buildUpdatesRequest, toPendingUpdates } from './updates';

// `ManagerKind` lives beside build-time tokens that only exist in a client bundle.
const PLUGINS: UpdatableKind = 0;
const THEMES: UpdatableKind = 1;

function entry(
	id: string,
	version: string = '1.0.0',
	kind: UpdatableKind = PLUGINS,
	name: string = id,
): InstalledEntry {
	return { kind, id, name, version };
}

function release(id: string, version: string): AddonUpdate {
	return {
		id,
		version,
		manifestUrl: `https://cdn.example/${id}/${version}/manifest.json`,
		bundleUrl: `https://cdn.example/${id}/${version}/index.js`,
		sha256: '0'.repeat(64),
		changelog: `Changes in ${version}.`,
		changes: null,
		changelogs: [
			{
				version,
				changelog: `Changes in ${version}.`,
				changes: null,
				publishedAt: '2026-10-17T12:00:00.000Z',
			},
		],
	};
}

describe('buildUpdatesRequest', () => {
	test('lists each marketplace addon once, skipping local ones without an id or semver', () => {
		const request = buildUpdatesRequest(
			[
				entry('dev.alpha'),
				entry('dev.alpha', '2.0.0', THEMES),
				entry('local plugin'),
				entry('dev.beta', 'next'),
				entry('dev.gamma', '0.3.1', THEMES),
			],
			'1.4.0',
		);

		expect(request).toEqual({
			clientVersion: '1.4.0',
			addons: [
				{ id: 'dev.alpha', version: '1.0.0' },
				{ id: 'dev.gamma', version: '0.3.1' },
			],
		});
	});

	test("sends each installed bundle's digest, so a rebuild of the same version is offered", () => {
		const digest = 'f'.repeat(64);
		const request = buildUpdatesRequest(
			[{ ...entry('dev.alpha'), sha256: digest }, entry('dev.beta')],
			'1.4.0',
		);

		expect(request?.addons).toEqual([
			{ id: 'dev.alpha', version: '1.0.0', sha256: digest },
			{ id: 'dev.beta', version: '1.0.0' },
		]);
	});

	test('sends nothing when no installed addon can be checked', () => {
		expect(buildUpdatesRequest([], '1.4.0')).toBeUndefined();
		expect(buildUpdatesRequest([entry('local plugin')], '1.4.0')).toBeUndefined();
	});
});

describe('toPendingUpdates', () => {
	test('pairs each update with its installed addon, sorted by name', () => {
		const zeta = release('dev.zeta', '2.0.0');
		const alpha = release('dev.alpha', '1.1.0');

		const pending = toPendingUpdates(
			[
				entry('dev.zeta', '1.0.0', THEMES, 'Zeta'),
				entry('dev.alpha', '1.0.0', PLUGINS, 'Alpha'),
				entry('dev.alpha', '9.0.0', THEMES, 'Shadowed'),
			],
			{ updates: [zeta, alpha] },
		);

		expect(pending).toEqual([
			{ kind: PLUGINS, id: 'dev.alpha', name: 'Alpha', from: '1.0.0', update: alpha },
			{ kind: THEMES, id: 'dev.zeta', name: 'Zeta', from: '1.0.0', update: zeta },
		]);
	});

	test('drops updates for addons that are no longer installed', () => {
		expect(
			toPendingUpdates([entry('dev.alpha')], { updates: [release('dev.gone', '1.1.0')] }),
		).toEqual([]);
	});
});
