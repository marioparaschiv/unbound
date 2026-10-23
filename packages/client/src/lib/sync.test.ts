import type { SyncDocument, SyncInstall } from '@unbound-app/contracts/sync';
import { emptySyncDocument } from '@unbound-app/contracts/sync';
import { describe, expect, test } from 'bun:test';

import { merge, plan, reconcileBase } from './sync';

type DocumentOptions = {
	plugins?: SyncInstall[];
	theme?: string | null;
	settings?: SyncDocument['settings'];
};

function plugin(
	id: string,
	enabled: boolean = true,
	url: string = `https://cdn.example/${id}.json`,
) {
	return { id, url, enabled };
}

function doc({ plugins = [], theme = null, settings = {} }: DocumentOptions = {}): SyncDocument {
	const document = emptySyncDocument();

	document.addons.plugins.installs = plugins;
	document.addons.themes.applied = theme;
	document.settings = settings;

	return document;
}

describe('merge', () => {
	test('installs an addon added remotely', () => {
		const { document, actions } = merge(doc(), doc(), doc({ plugins: [plugin('a')] }));

		expect(actions).toEqual([{ type: 'install', kind: 'plugins', install: plugin('a') }]);
		expect(document.addons.plugins.installs).toEqual([plugin('a')]);
	});

	test('deletes an addon removed remotely', () => {
		const base = doc({ plugins: [plugin('a'), plugin('b')] });
		const { document, actions } = merge(base, base, doc({ plugins: [plugin('b')] }));

		expect(actions).toEqual([{ type: 'delete', kind: 'plugins', id: 'a' }]);
		expect(document.addons.plugins.installs).toEqual([plugin('b')]);
	});

	test('keeps local-only changes and pushes them', () => {
		const base = doc({ plugins: [plugin('a')], settings: { unbound: { toasts: true } } });
		const local = doc({
			plugins: [plugin('a', false), plugin('b')],
			theme: 'dark',
			settings: { unbound: { toasts: false } },
		});
		const { document, actions } = merge(base, local, base);

		expect(actions).toEqual([]);
		expect(document).toEqual(local);
	});

	test('keeps a local delete instead of reinstalling it', () => {
		const base = doc({ plugins: [plugin('a')] });
		const { document, actions } = merge(base, doc(), base);

		expect(actions).toEqual([]);
		expect(document.addons.plugins.installs).toEqual([]);
	});

	test('applies remote enabled, applied and URL changes', () => {
		const base = doc({ plugins: [plugin('a')] });
		const moved = plugin('a', false, 'https://example.com/a.json');
		const { actions } = merge(base, base, doc({ plugins: [moved], theme: 'dark' }));

		expect(actions).toEqual([
			{ type: 'install', kind: 'plugins', install: moved },
			{ type: 'set-enabled', kind: 'plugins', id: 'a', enabled: false },
			{ type: 'apply', kind: 'themes', id: 'dark' },
		]);
	});

	test('applies remote setting changes key by key, local ones stand', () => {
		const base = doc({ settings: { unbound: { a: 1, b: 1, c: 1 }, p: { x: 1 } } });
		const local = doc({ settings: { unbound: { a: 2, b: 1, c: 1 }, p: { x: 1 } } });
		const remote = doc({ settings: { unbound: { a: 1, b: { nested: true }, c: 1 } } });
		const { document, actions } = merge(base, local, remote);

		expect(actions).toEqual([
			{ type: 'set-setting', store: 'unbound', key: 'b', value: { nested: true } },
			{ type: 'set-setting', store: 'p', key: 'x', value: undefined },
		]);
		expect(document.settings).toEqual({ unbound: { a: 2, b: { nested: true }, c: 1 } });
	});

	test('a first sync unions addons and adopts remote settings', () => {
		const local = doc({ plugins: [plugin('mine')], settings: { unbound: { a: 1 } } });
		const remote = doc({ plugins: [plugin('theirs')], settings: { unbound: { a: 2 } } });
		const { document, actions } = merge(emptySyncDocument(), local, remote);

		expect(document.addons.plugins.installs.map(({ id }) => id)).toEqual(['mine', 'theirs']);
		expect(document.settings).toEqual({ unbound: { a: 2 } });
		expect(actions.map((action) => action.type)).toEqual(['install', 'set-setting']);
	});

	test('is idempotent: merging its own output again yields no actions', () => {
		const base = doc({ plugins: [plugin('a'), plugin('b')], settings: { unbound: { a: 1 } } });
		const local = doc({ plugins: [plugin('a'), plugin('c')], settings: { unbound: { a: 1 } } });
		const remote = doc({
			plugins: [plugin('a', false), plugin('d')],
			theme: 'dark',
			settings: { unbound: { a: 3 } },
		});
		const first = merge(base, local, remote);
		const second = merge(base, first.document, remote);

		expect(first.actions).not.toEqual([]);
		expect(second.actions).toEqual([]);
		expect(second.document).toEqual(first.document);
		expect(merge(first.document, first.document, first.document).actions).toEqual([]);
	});
});

describe('reconcileBase', () => {
	test('retries a failed install on the next sync instead of reading it as a delete', () => {
		const remote = doc({ plugins: [plugin('a')] });
		const { document, actions } = merge(doc(), doc(), remote);
		const base = reconcileBase(document, doc(), actions);

		expect(merge(base, doc(), remote).actions).toEqual(actions);
	});

	test('retries a failed delete on the next sync instead of reading it as an add', () => {
		const previous = doc({ plugins: [plugin('a')] });
		const { document, actions } = merge(previous, previous, doc());
		const base = reconcileBase(document, previous, actions);

		expect(merge(base, previous, doc()).actions).toEqual(actions);
	});
});

describe('plan', () => {
	const base = doc({ plugins: [plugin('shared')], settings: { unbound: { a: 1 } } });
	const local = doc({
		plugins: [plugin('shared', false), plugin('mine')],
		settings: { unbound: { a: 2, b: 1 } },
	});
	const remote = doc({
		plugins: [plugin('shared'), plugin('theirs')],
		settings: { unbound: { a: 3 } },
	});

	test('pull makes this device match the cloud, removing what only this device has', () => {
		const { document, actions } = plan('pull', base, local, remote);

		expect(document).toEqual(remote);
		expect(actions).toContainEqual({ type: 'delete', kind: 'plugins', id: 'mine' });
		expect(actions).toContainEqual({
			type: 'install',
			kind: 'plugins',
			install: plugin('theirs'),
		});
		expect(actions).toContainEqual({
			type: 'set-enabled',
			kind: 'plugins',
			id: 'shared',
			enabled: true,
		});
		expect(actions).toContainEqual({
			type: 'set-setting',
			store: 'unbound',
			key: 'b',
			value: undefined,
		});
	});

	test('push keeps this device as it is and uploads it', () => {
		expect(plan('push', base, local, remote)).toEqual({ document: local, actions: [] });
	});

	test('pulling twice changes nothing the second time', () => {
		const { document } = plan('pull', base, local, remote);

		expect(plan('pull', document, document, remote).actions).toEqual([]);
	});
});
