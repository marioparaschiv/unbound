import { beforeEach, describe, expect, test } from 'bun:test';
import { ADDON_KINDS } from '@unbound-app/types/addons';

import { loadManagers, openedBuckets, rerendersOn, subscriptions } from './helpers/addons';

const Manager = await loadManagers();

const { default: useDevelopmentCopy } = await import('~/ui/hooks/use-development-copy');
const { default: useAddonState } = await import('~/ui/hooks/use-addon-state');

type ListedKind = 'plugin' | 'theme' | 'icon-pack';

const LISTED_BUCKETS: [kind: ListedKind, bucket: string][] = [
	['plugin', 'plugins'],
	['theme', 'themes'],
	['icon-pack', 'icons'],
];

test('resolves the manager of every addon kind', () => {
	for (const kind of ADDON_KINDS) {
		expect(Manager.for(kind).kind).toBe(kind);
	}
});

test('keeps each manager on the bucket name it has always persisted to', () => {
	const buckets = Object.fromEntries(ADDON_KINDS.map((kind) => [kind, Manager.for(kind).bucket]));

	expect(buckets).toEqual({
		plugin: 'plugins',
		theme: 'themes',
		'icon-pack': 'icons',
		font: 'fonts',
	});
	expect(openedBuckets).toEqual(['plugins', 'themes', 'icons', 'fonts']);
});

describe('addon hooks', () => {
	beforeEach(() => {
		subscriptions.length = 0;
	});

	for (const [kind, bucket] of LISTED_BUCKETS) {
		test(`re-renders ${kind} addons when its enabled state changes in the ${bucket} bucket`, () => {
			useAddonState(kind, 'addon');

			expect(rerendersOn({ store: bucket, key: 'states' })).toBe(true);
			expect(rerendersOn({ store: bucket, key: 'applied' })).toBe(true);
			expect(rerendersOn({ store: kind, key: 'states' })).toBe(false);
		});

		test(`re-renders ${kind} addons when its development markers change in the ${bucket} bucket`, () => {
			useDevelopmentCopy(kind, 'addon');

			expect(rerendersOn({ store: bucket, key: 'development' })).toBe(true);
			expect(rerendersOn({ store: kind, key: 'development' })).toBe(false);
		});
	}
});
