import { beforeEach, expect, mock, test } from 'bun:test';

import type { SettingsPayload } from './storage';

type Effect = () => (() => void) | void;

let stateUpdates = 0;
const cleanups: Array<(() => void) | void> = [];

function rendererlessReact() {
	return {
		useState: () => [{}, () => void stateUpdates++],
		useEffect: (effect: Effect) => void cleanups.push(effect()),
	};
}

mock.module('react', rendererlessReact);

const storage = await import('./storage');
const { get, on, remove, set, settings } = storage;

beforeEach(() => {
	stateUpdates = 0;

	for (const cleanup of cleanups.splice(0)) {
		cleanup?.();
	}
});

test('removes keys whose value is falsy', () => {
	const removed: string[] = [];

	on('removed', ({ key }) => removed.push(key));

	set('storage-test', 'enabled', false);
	set('storage-test', 'count', 0);
	set('storage-test', 'label', '');
	set('storage-test', 'kept', true);

	remove('storage-test', 'enabled');
	remove('storage-test', 'count');
	remove('storage-test', 'label');

	expect(removed).toEqual(['enabled', 'count', 'label']);
	expect(get('storage-test', 'enabled', 'missing')).toBe('missing');
	expect(settings['storage-test']).toEqual({ kept: true });
});

test('ignores a key in a store that does not exist', () => {
	expect(() => remove('storage-test-missing', 'key')).not.toThrow();
});

test('removes a value at a nested key path and prunes what it leaves empty', () => {
	set('storage-nested', 'toasts.duration', 300);
	set('storage-nested', 'toasts.opacity', 0.5);

	remove('storage-nested', 'toasts.duration');

	expect(get('storage-nested', 'toasts.duration', 5000)).toBe(5000);
	expect(settings['storage-nested']).toEqual({ toasts: { opacity: 0.5 } });

	remove('storage-nested', 'toasts.opacity');

	expect(settings['storage-nested']).toBeUndefined();
	expect(() => remove('storage-nested', 'toasts.missing.deeper')).not.toThrow();
});

test('saves a Bucket under its own name, so old and new forms share it', () => {
	const bucket = storage.getBucket('storage-bucket');
	const store = storage.getStore('storage-bucket');

	bucket.set('appearance.compact', true);

	expect(settings['storage-bucket']).toEqual({ appearance: { compact: true } });
	expect(store.get('appearance.compact', false)).toBe(true);
	expect(storage.get('storage-bucket', 'appearance.compact', false)).toBe(true);

	store.set('volume', 0.8);
	storage.set('storage-bucket', 'muted', false);

	expect(bucket.get('volume', 1)).toBe(0.8);
	expect(bucket.get('missing', 'default')).toBe('default');

	bucket.toggle('muted', true);
	store.toggle('muted', true);
	storage.toggle('storage-bucket', 'muted', true);

	expect(bucket.get('muted', false)).toBe(true);

	bucket.remove('volume');

	expect(store.get('volume', 1)).toBe(1);

	store.clear();

	expect(settings['storage-bucket']).toBeUndefined();

	bucket.set('volume', 0.5);
	storage.clear('storage-bucket');

	expect(bucket.get('volume', 1)).toBe(1);
});

test('notifies onChange and the old listener forms of the same Bucket changes', () => {
	const seen: string[] = [];
	const bucket = storage.getBucket('storage-listeners');

	const offChange = storage.onChange(
		({ store }) => store === 'storage-listeners',
		({ key }) => seen.push(`onChange:${key}`),
	);

	function legacy({ key }: SettingsPayload) {
		seen.push(`addListener:${key}`);
	}

	storage.addListener(({ store }) => store === 'storage-listeners', legacy);

	const offBucket = storage.getStore('storage-listeners').addListener(
		() => true,
		({ key }) => seen.push(`bucket:${key}`),
	);

	storage.set('storage-other', 'ignored', true);
	bucket.set('first', 1);

	expect(seen).toEqual(['onChange:first', 'addListener:first', 'bucket:first']);

	offChange();
	storage.removeListener(legacy);
	offBucket();
	bucket.set('second', 2);

	expect(seen).toHaveLength(3);
});

test('re-renders useBucket and useSettingsStore only for changes to their Bucket', () => {
	const bucket = storage.useBucket('storage-hook');
	const store = storage.useSettingsStore('storage-hook');
	const nested = storage
		.getStore('storage-hook')
		.useSettingsStore(({ key }) => key === 'watched');

	bucket.set('value', 1);

	expect(stateUpdates).toBe(2);
	expect(store.get('value', 0)).toBe(1);

	storage.getBucket('storage-hook-other').set('value', 1);
	nested.set('watched', true);

	expect(stateUpdates).toBe(5);

	storage.set('storage-hook', 'unwatched', true);

	expect(stateUpdates).toBe(7);
});
