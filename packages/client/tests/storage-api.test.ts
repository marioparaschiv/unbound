import { afterEach, describe, expect, mock, test } from 'bun:test';

import type { Bucket } from '~/storage/api';

import { createHookRenderer } from './helpers/render-hook';

const { React, renderHook } = createHookRenderer();

mock.module('react', () => React);

const storage = await import('~/storage/api');
// `flux` re-exports these; importing them from there would load the real Flux modules into this process.
const { shallow, useShallow } = await import('~/utils/react/shallow');
const settings = storage.snapshot();
const mounted: { unmount: () => void }[] = [];

function render<T>(hook: () => T) {
	const rendered = renderHook(hook);

	mounted.push(rendered);

	return rendered;
}

afterEach(() => {
	for (const rendered of mounted.splice(0)) rendered.unmount();
});

test('removes keys whose value is falsy', () => {
	const bucket = storage.getBucket('storage-test');
	const removed: (string | null)[] = [];

	const off = storage.onChange(
		({ store, value }) => store === 'storage-test' && value === undefined,
		({ key }) => removed.push(key),
	);

	bucket.set('enabled', false);
	bucket.set('count', 0);
	bucket.set('label', '');
	bucket.set('kept', true);

	bucket.remove('enabled');
	bucket.remove('count');
	bucket.remove('label');
	off();

	expect(removed).toEqual(['enabled', 'count', 'label']);
	expect(bucket.get('enabled', 'missing')).toBe('missing');
	expect(settings['storage-test']).toEqual({ kept: true });
});

test('ignores a key in a store that does not exist', () => {
	expect(() => storage.getBucket('storage-test-missing').remove('key')).not.toThrow();
});

test('removes a value at a nested key path and prunes what it leaves empty', () => {
	const bucket = storage.getBucket('storage-nested');

	bucket.set('toasts.duration', 300);
	bucket.set('toasts.opacity', 0.5);

	bucket.remove('toasts.duration');

	expect(bucket.get('toasts.duration', 5000)).toBe(5000);
	expect(settings['storage-nested']).toEqual({ toasts: { opacity: 0.5 } });

	bucket.remove('toasts.opacity');

	expect(settings['storage-nested']).toBeUndefined();
	expect(() => bucket.remove('toasts.missing.deeper')).not.toThrow();
});

test('saves a Bucket under its own name, so every handle to it shares it', () => {
	const bucket = storage.getBucket('storage-bucket');
	const other = storage.getBucket('storage-bucket');

	bucket.set('appearance.compact', true);

	expect(settings['storage-bucket']).toEqual({ appearance: { compact: true } });
	expect(other.get('appearance.compact', false)).toBe(true);

	other.set('volume', 0.8);

	expect(bucket.get('volume', 1)).toBe(0.8);
	expect(bucket.get('missing', 'default')).toBe('default');

	bucket.toggle('muted', false);

	expect(other.get('muted', false)).toBe(true);

	bucket.remove('volume');

	expect(other.get('volume', 1)).toBe(1);

	other.clear();

	expect(settings['storage-bucket']).toBeUndefined();
});

test('notifies onChange only for changes its predicate accepts, until removed', () => {
	const seen: (string | null)[] = [];
	const bucket = storage.getBucket('storage-listeners');

	const off = storage.onChange(
		({ store }) => store === 'storage-listeners',
		({ key }) => seen.push(key),
	);

	storage.getBucket('storage-other').set('ignored', true);
	bucket.set('first', 1);

	expect(seen).toEqual(['first']);

	off();
	bucket.set('second', 2);

	expect(seen).toEqual(['first']);
});

test('re-renders useBucket only for changes to its Bucket that its predicate accepts', () => {
	const all = render(() => storage.useBucket('storage-hook'));
	const watched = render(() => storage.useBucket('storage-hook', ({ key }) => key === 'watched'));
	const bucket = storage.getBucket('storage-hook');

	bucket.set('value', 1);
	storage.getBucket('storage-hook-other').set('value', 1);

	expect([all.renders, watched.renders]).toEqual([2, 1]);

	bucket.set('watched', true);

	expect([all.renders, watched.renders]).toEqual([3, 2]);
});

describe('useSetting', () => {
	test('re-renders when the selected value changes, and not on a write to another key', () => {
		const bucket = storage.getBucket('use-setting');
		const greet = render(() =>
			storage.useSetting('use-setting', (current) => current.get('greet', true)),
		);

		bucket.set('other', 1);
		storage.getBucket('use-setting-other').set('greet', false);

		expect([greet.current, greet.renders]).toEqual([true, 1]);

		bucket.set('greet', false);

		expect([greet.current, greet.renders]).toEqual([false, 2]);
	});

	test('re-renders an object selector on every write, unless useShallow wraps it', () => {
		const bucket = storage.getBucket('use-setting-shallow');
		const select = (current: Bucket) => ({ size: current.get('size', 1) });
		const plain = render(() => storage.useSetting('use-setting-shallow', select));
		const wrapped = render(() => storage.useSetting('use-setting-shallow', useShallow(select)));

		bucket.set('other', 1);

		expect([plain.renders, wrapped.renders]).toEqual([2, 1]);

		bucket.set('size', 2);

		expect([plain.renders, wrapped.renders]).toEqual([3, 2]);
		expect(wrapped.current).toEqual({ size: 2 });
	});

	test('honours isEqual', () => {
		const bucket = storage.getBucket('use-setting-equal');
		const select = (current: Bucket) => [current.get('first', 0)];
		const shallowEqual = render(() => storage.useSetting('use-setting-equal', select, shallow));
		const neverEqual = render(() =>
			storage.useSetting('use-setting-equal', select, () => false),
		);

		bucket.set('other', 1);

		expect([shallowEqual.renders, neverEqual.renders]).toEqual([1, 2]);

		bucket.set('first', 1);

		expect(shallowEqual.current).toEqual([1]);
		expect(shallowEqual.renders).toBe(2);
	});
});
