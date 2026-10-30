import type { AddonUpdate, UpdateReason } from '@unbound-app/contracts/updates';
import { addonUpdateSchema } from '@unbound-app/contracts/updates';
import { describe, expect, test } from 'bun:test';

import type { InstalledEntry, UpdatableKind, UpdatableManager } from './updates';

import { autoApplies, automaticUpdates, buildUpdatesRequest, toPendingUpdates } from './updates';

function entry(
	id: string,
	version: string = '1.0.0',
	kind: UpdatableKind = 'plugins',
	name: string = id,
): InstalledEntry {
	return { kind, id, name, version };
}

function release(id: string, version: string, reason: UpdateReason = 'newer'): AddonUpdate {
	return {
		id,
		version,
		reason,
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
				entry('dev.alpha', '2.0.0', 'themes'),
				entry('local plugin'),
				entry('dev.beta', 'next'),
				entry('dev.gamma', '0.3.1', 'themes'),
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
				entry('dev.zeta', '1.0.0', 'themes', 'Zeta'),
				entry('dev.alpha', '1.0.0', 'plugins', 'Alpha'),
				entry('dev.alpha', '9.0.0', 'themes', 'Shadowed'),
			],
			{ updates: [zeta, alpha] },
		);

		expect(pending).toEqual([
			{ kind: 'plugins', id: 'dev.alpha', name: 'Alpha', from: '1.0.0', update: alpha },
			{ kind: 'themes', id: 'dev.zeta', name: 'Zeta', from: '1.0.0', update: zeta },
		]);
	});

	test('drops updates for addons that are no longer installed', () => {
		expect(
			toPendingUpdates([entry('dev.alpha')], { updates: [release('dev.gone', '1.1.0')] }),
		).toEqual([]);
	});
});

describe('autoApplies', () => {
	test('applies every update to an addon that is not held', () => {
		for (const reason of ['newer', 'withdrawn', 'rebuilt'] as const) {
			expect(autoApplies(release('dev.alpha', '2.0.0', reason), false)).toBe(true);
		}
	});

	test('keeps a held addon off newer versions', () => {
		expect(autoApplies(release('dev.alpha', '2.0.0', 'newer'), true)).toBe(false);
	});

	test('still replaces a held version that was withdrawn or rebuilt', () => {
		expect(autoApplies(release('dev.alpha', '2.0.0', 'withdrawn'), true)).toBe(true);
		expect(autoApplies(release('dev.alpha', '1.0.0', 'rebuilt'), true)).toBe(true);
	});

	test('reads an update from a server without reasons as newer', () => {
		const { reason: _, ...legacy } = release('dev.alpha', '2.0.0');
		const parsed = addonUpdateSchema.parse(legacy);

		expect(parsed.reason).toBe('newer');
		expect(autoApplies(parsed, true)).toBe(false);
	});
});

describe('automaticUpdates', () => {
	test('leaves out newer versions of held addons and keeps the rest', () => {
		const held = new Map([['dev.held', '1.0.0']]);
		const manager: UpdatableManager = {
			getEntities: () => [],
			getEntity: () => undefined,
			update: async () => {},
			getHeldVersion: (id) => held.get(id),
		};
		const pending = toPendingUpdates([entry('dev.held'), entry('dev.free')], {
			updates: [release('dev.held', '2.0.0'), release('dev.free', '2.0.0')],
		});

		expect(automaticUpdates(pending, () => manager).map(({ id }) => id)).toEqual(['dev.free']);
	});
});
