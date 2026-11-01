import { beforeEach, expect, mock, test } from 'bun:test';

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

const storage = await import('./api');
const settings = storage.snapshot();

beforeEach(() => {
	stateUpdates = 0;

	for (const cleanup of cleanups.splice(0)) {
		cleanup?.();
	}
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
	const bucket = storage.useBucket('storage-hook');

	storage.useBucket('storage-hook', ({ key }) => key === 'watched');

	bucket.set('value', 1);

	expect(stateUpdates).toBe(1);

	storage.getBucket('storage-hook-other').set('value', 1);
	bucket.set('watched', true);

	expect(stateUpdates).toBe(3);
});
