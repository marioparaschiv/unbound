import type { NativeSettingsChange } from '@unbound-app/types/native';
import { beforeEach, expect, test } from 'bun:test';

import { persist, snapshot } from '~/storage/api';

const settings = snapshot();

import { renameLegacyBuckets } from './legacy-buckets';

const applied: NativeSettingsChange[] = [];

Object.defineProperty(globalThis, 'NativePlatform', {
	configurable: true,
	writable: true,
	value: {
		settings: {
			apply: (changes: readonly NativeSettingsChange[]) => applied.push(...changes) > 0,
		},
	},
});

beforeEach(async () => {
	await persist();
	applied.length = 0;

	for (const name of Object.keys(settings)) {
		delete settings[name];
	}
});

test('moves the legacy core and plugin Buckets to the unbound names', async () => {
	Object.assign(settings, {
		astral: { 'developer-mode': true, debugger: { address: '10.0.0.2:9091', enabled: true } },
		'astral.text-replace': { stringRules: [{ find: 'a', replace: 'b' }] },
		themes: { applied: 'mp.midnight' },
	});

	renameLegacyBuckets();

	expect(settings).toEqual({
		unbound: { 'developer-mode': true, debugger: { address: '10.0.0.2:9091', enabled: true } },
		'unbound.text-replace': { stringRules: [{ find: 'a', replace: 'b' }] },
		themes: { applied: 'mp.midnight' },
	});

	await persist();

	expect(applied).toContainEqual({ store: 'astral', clear: true });
	expect(applied).toContainEqual({ store: 'astral.text-replace', clear: true });
	expect(applied).toContainEqual({ store: 'unbound', key: 'developer-mode', value: true });
});

test('keeps every value already saved under the unbound names and fills only what is missing', () => {
	Object.assign(settings, {
		unbound: {
			'developer-mode': false,
			debugger: { address: '192.168.1.5:9092' },
			loader: { update: { url: 'http://dev/unbound.bundle' } },
		},
		astral: {
			'developer-mode': true,
			debugger: { address: '10.0.0.2:9091', enabled: true },
			toasts: { duration: 300 },
		},
		'unbound.text-replace': { stringRules: [] },
		'astral.text-replace': { stringRules: [{ find: 'a', replace: 'b' }], regexRules: [] },
	});

	renameLegacyBuckets();

	expect(settings).toEqual({
		unbound: {
			'developer-mode': false,
			debugger: { address: '192.168.1.5:9092', enabled: true },
			loader: { update: { url: 'http://dev/unbound.bundle' } },
			toasts: { duration: 300 },
		},
		'unbound.text-replace': { stringRules: [], regexRules: [] },
	});
});

test('renames plugin states keyed by a legacy id, replacing the older state of the new id', () => {
	settings.plugins = {
		states: {
			'astral.moyai': true,
			'astral.translate': true,
			'unbound.translate': false,
			'mp.clean-embeds': true,
		},
		held: { 'mp.message-timestamps': '2.2.0' },
	};

	renameLegacyBuckets();

	expect(settings.plugins).toEqual({
		states: { 'unbound.moyai': true, 'unbound.translate': true, 'mp.clean-embeds': true },
		held: { 'mp.message-timestamps': '2.2.0' },
	});
});

test('changes nothing on a second run or for settings with no legacy names', async () => {
	settings.unbound = { recovery: true };
	settings.plugins = { states: { 'unbound.moyai': true } };

	renameLegacyBuckets();
	await persist();

	expect(applied).toEqual([]);
	expect(settings).toEqual({
		unbound: { recovery: true },
		plugins: { states: { 'unbound.moyai': true } },
	});
});
