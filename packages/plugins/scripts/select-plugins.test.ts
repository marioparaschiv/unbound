import { expect, test } from 'bun:test';

import type { LocalPlugin, PublishedVersion } from '@scripts/select-plugins';
import { getSelected, selectPlugins } from '@scripts/select-plugins';

function plugin(version: string): LocalPlugin {
	return { id: 'unbound.example', dir: 'example', version, bundle: 'example/dist/index.js' };
}

function live(version: string): PublishedVersion {
	return { version, commitSha: null, repository: null };
}

function decide(local: string, published?: string) {
	const map = new Map(published ? [['unbound.example', live(published)]] : []);
	const [decision] = selectPlugins([plugin(local)], map);

	return decision && { status: decision.status, reason: decision.reason };
}

test('an unpublished plugin is selected', () => {
	expect(decide('1.0.0')).toEqual({ status: 'selected', reason: 'unpublished' });
});

test('a newer local version is selected', () => {
	expect(decide('1.1.0', '1.0.0')).toEqual({ status: 'selected', reason: 'newer' });
	expect(decide('1.10.0', '1.9.0')).toEqual({ status: 'selected', reason: 'newer' });
});

test('an equal version is skipped as already published', () => {
	expect(decide('1.0.0', '1.0.0')).toEqual({ status: 'skipped', reason: 'already-published' });
});

test('an older local version is skipped as behind', () => {
	expect(decide('1.0.0', '1.2.0')).toEqual({ status: 'skipped', reason: 'behind-published' });
});

test('prereleases order below their release', () => {
	expect(decide('1.0.0', '1.0.0-beta.2')).toEqual({ status: 'selected', reason: 'newer' });
	expect(decide('1.0.0-beta.2', '1.0.0-beta.1')).toEqual({ status: 'selected', reason: 'newer' });
	expect(decide('1.0.0-beta.1', '1.0.0')).toEqual({
		status: 'skipped',
		reason: 'behind-published',
	});
});

test('getSelected keeps only the selected plugins, in order', () => {
	const a = { ...plugin('2.0.0'), id: 'unbound.a' };
	const b = { ...plugin('1.0.0'), id: 'unbound.b' };
	const c = { ...plugin('1.0.0'), id: 'unbound.c' };
	const published = new Map([
		['unbound.a', live('1.0.0')],
		['unbound.b', live('1.0.0')],
	]);

	expect(getSelected(selectPlugins([a, b, c], published)).map((d) => d.plugin.id)).toEqual([
		'unbound.a',
		'unbound.c',
	]);
});
