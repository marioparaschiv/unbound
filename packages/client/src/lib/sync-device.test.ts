import type { SyncDocument } from '@unbound-app/contracts/sync';
import { emptySyncDocument } from '@unbound-app/contracts/sync';
import { beforeEach, describe, expect, mock, test } from 'bun:test';

type Stores = Record<string, Record<string, string | null | Record<string, string | boolean>>>;

let stores: Stores = {};

function read(store: string, key: string, fallback: string | null) {
	return stores[store]?.[key] ?? fallback;
}

mock.module('~/api/storage', () => ({
	default: { get: read },
	settings: {},
}));

mock.module('~/managers/plugins', () => ({ plugins: {} }));
mock.module('~/managers/themes', () => ({ themes: {} }));
mock.module('~/managers/fonts', () => ({ fonts: { getEntities: () => [] } }));
mock.module('~/managers/icons', () => ({
	icons: { applied: { manifest: { id: 'default' } }, isEnabled: () => true },
}));

const { collectLocalDocument } = await import('./sync-device');

function base(theme: string | null): SyncDocument {
	const document = emptySyncDocument();

	document.addons.themes.applied = theme;

	return document;
}

beforeEach(() => {
	stores = {
		themes: {
			applied: null,
			sources: { 'acme.midnight': 'https://cdn.example/midnight.json' },
		},
	};
});

describe('collectLocalDocument', () => {
	test('reports an applied theme that was installed from a URL', () => {
		stores.themes.applied = 'acme.midnight';

		expect(collectLocalDocument(base(null)).addons.themes.applied).toBe('acme.midnight');
	});

	test('reports no theme when none is applied', () => {
		expect(collectLocalDocument(base('acme.midnight')).addons.themes.applied).toBeNull();
	});

	test('keeps the agreed theme while a theme with no source is applied', () => {
		stores.themes.applied = 'local--0123456789abcdef';

		const document = collectLocalDocument(base('acme.midnight'));

		expect(document.addons.themes.applied).toBe('acme.midnight');
		expect(document.addons.themes.installs.map((install) => install.id)).toEqual([
			'acme.midnight',
		]);
	});

	test('reports no theme for a sourceless theme when nothing was agreed', () => {
		stores.themes.applied = 'local--0123456789abcdef';

		expect(collectLocalDocument().addons.themes.applied).toBeNull();
	});
});
