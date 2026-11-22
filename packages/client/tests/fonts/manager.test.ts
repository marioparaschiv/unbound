import type {
	UnboundFontPreset,
	UnboundFontPresetDraft,
	UnboundNativeFonts,
} from '@unbound-app/types';
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { AddonVersion } from '@unbound-app/contracts/addons';

import { makeManifest } from '../helpers/addons';

const toasts: string[] = [];
const progress: number[] = [];
let bundle = '';

type ShownToast = { content?: string; progress?: number };

function record({ content, progress: fraction }: ShownToast) {
	if (content) {
		toasts.push(content);
	}

	if (fraction !== undefined) {
		progress.push(fraction);
	}
}

mock.module('~/toasts/api', () => ({
	show: (options: ShownToast) => {
		record(options);

		return { update: record, close: () => undefined };
	},
}));
mock.module('~/addons/download', () => ({ downloadBundle: async () => bundle }));

// The manager reads Discord's constants off `window` while it loads.
Reflect.set(globalThis, 'window', globalThis);

const { fonts } = await import('~/fonts/manager');

const PACK = { 'ggsans-Normal': { google: 'Geist', weight: 400, style: 'normal' as const } };

let presets: UnboundFontPreset[] = [];
let drafts: UnboundFontPresetDraft[] = [];
let applied: string[] = [];
let installs: unknown[][] = [];

function installBridge() {
	const bridge: Partial<UnboundNativeFonts> = {
		list: () => ({ fonts: [], overrides: {}, families: {} }),
		listPresets: () => presets,
		install: async (...args) => {
			installs.push(args);

			return { installed: [], errors: [] };
		},
		savePreset: async (draft) => {
			drafts.push(draft);

			const preset = {
				id: draft.id ?? draft.name.toLowerCase(),
				name: draft.name,
				overrides: draft.overrides ?? {},
			};

			presets = [...presets.filter((entry) => entry.id !== preset.id), preset];

			return preset;
		},
		applyPreset: async (id) => {
			applied.push(id);

			return { applied: ['ggsans-Normal'], unavailable: [], skipped: [], errors: [] };
		},
	};

	Reflect.set(globalThis, 'UnboundNative', { fonts: bridge });
}

function version(name: string): AddonVersion {
	return {
		version: '1.0.0',
		manifest: { ...makeManifest('unbound.pack'), name, type: 'font', main: 'bundle.json' },
		changelog: null,
		changes: null,
		source: null,
		bundleSize: 1,
		sha256: '0'.repeat(64),
		publishedAt: '2024-01-01T00:00:00.000Z',
		manifestUrl: 'https://cdn.test/pack/manifest.json',
		bundleUrl: 'https://cdn.test/pack/bundle.json',
	};
}

beforeEach(() => {
	presets = [];
	drafts = [];
	applied = [];
	installs = [];
	toasts.length = 0;
	progress.length = 0;
	bundle = JSON.stringify({ name: 'Shared Name', overrides: PACK });
	installBridge();
});

describe('Fonts.installListed', () => {
	test('saves the pack as a preset under its listed name and applies it', async () => {
		expect(await fonts.installListed({ id: 'unbound.pack' }, version('Pack'))).toBe(true);
		expect(drafts).toEqual([{ name: 'Pack', overrides: PACK }]);
		expect(applied).toEqual(['pack']);
		expect(toasts.at(-1)).toContain('Applied');
	});

	test('downloads each missing face under a filling progress toast before applying', async () => {
		await fonts.installListed({ id: 'unbound.pack' }, version('Pack'));

		expect(installs).toEqual([['Geist', [{ weight: 400, style: 'normal' }]]]);
		expect(progress).toEqual([0, 0, 1]);
		expect(toasts[0]).toContain('"family":"Geist"');
	});

	test('replaces the preset an earlier apply saved', async () => {
		presets = [{ id: 'kept', name: 'Pack', overrides: {} }];

		await fonts.installListed({ id: 'unbound.pack' }, version('Pack'));

		expect(drafts[0]?.id).toBe('kept');
		expect(presets).toHaveLength(1);
		expect(applied).toEqual(['kept']);
	});

	test('fails without saving when the bundle is not a preset', async () => {
		bundle = '{ "type": "dark" }';

		expect(await fonts.installListed({ id: 'unbound.pack' }, version('Pack'))).toBe(false);
		expect(drafts).toEqual([]);
		expect(fonts.errors.get('unbound.pack')?.message).toContain('not a font preset');
	});
});
