import { describe, expect, mock, test } from 'bun:test';

import { ReactionUserCache } from './reactor-cache';
import { reactionAvatarKey, type Reactor } from './avatars';

function deferred() {
	let resolve: (users: Reactor[]) => void = () => undefined;
	const promise = new Promise<Reactor[]>((settle) => {
		resolve = settle;
	});

	return { promise, resolve };
}

describe('ReactionUserCache', () => {
	test('invalidates all cached reactions for one message without clearing other messages', async () => {
		const cache = new ReactionUserCache<Reactor>();
		const emoji = { id: 'emoji', name: 'wave' };
		const affectedNormal = reactionAvatarKey('channel', 'message', emoji, [0]);
		const affectedBurst = reactionAvatarKey('channel', 'message', emoji, [1]);
		const unrelated = reactionAvatarKey('channel', 'another-message', emoji, [0]);
		const load = async () => [{ id: 'user' }];

		await Promise.all([
			cache.load(affectedNormal, load),
			cache.load(affectedBurst, load),
			cache.load(unrelated, load),
		]);
		cache.invalidateMessage('message', 'channel');

		expect(cache.get(affectedNormal)).toBeUndefined();
		expect(cache.get(affectedBurst)).toBeUndefined();
		expect(cache.get(unrelated)).toEqual([{ id: 'user' }]);

		cache.invalidateMessage('another-message');

		expect(cache.get(unrelated)).toBeUndefined();
	});

	test('deduplicates concurrent requests for the same reaction', async () => {
		const cache = new ReactionUserCache<Reactor>(2, 1, 1000);
		const load = mock(async () => [{ id: 'user' }]);

		const [first, second] = await Promise.all([
			cache.load('first', load),
			cache.load('first', load),
		]);

		expect(load).toHaveBeenCalledTimes(1);
		expect(first).toEqual(second);
		expect(cache.get('first')).toEqual([{ id: 'user' }]);
	});

	test('evicts the least recently used list past its capacity', async () => {
		const cache = new ReactionUserCache<Reactor>(2, 1, 1000);

		await cache.load('first', async () => [{ id: 'first' }]);
		await cache.load('second', async () => [{ id: 'second' }]);
		cache.get('first');
		await cache.load('third', async () => [{ id: 'third' }]);

		expect(cache.get('first')).toEqual([{ id: 'first' }]);
		expect(cache.get('second')).toBeUndefined();
		expect(cache.get('third')).toEqual([{ id: 'third' }]);
	});

	test('serializes requests when limited to one at a time', async () => {
		const cache = new ReactionUserCache<Reactor>(4, 1, 1000);
		const first = deferred();
		const firstLoad = mock(() => first.promise);
		const secondLoad = mock(async () => [{ id: 'second' }]);
		const firstRequest = cache.load('first', firstLoad);
		const secondRequest = cache.load('second', secondLoad);

		await Promise.resolve();
		expect(firstLoad).toHaveBeenCalledTimes(1);
		expect(secondLoad).not.toHaveBeenCalled();

		first.resolve([{ id: 'first' }]);
		expect(await firstRequest).toEqual([{ id: 'first' }]);
		expect(await secondRequest).toEqual([{ id: 'second' }]);
		expect(secondLoad).toHaveBeenCalledTimes(1);
	});

	test('loads requests in bounded parallel batches', async () => {
		const cache = new ReactionUserCache<Reactor>(10, 3, 1000);
		let active = 0;
		let maximumActive = 0;

		async function load(id: string) {
			active++;
			maximumActive = Math.max(maximumActive, active);
			await Promise.resolve();
			active--;

			return [{ id }];
		}

		await Promise.all(
			['first', 'second', 'third', 'fourth', 'fifth'].map((id) =>
				cache.load(id, () => load(id)),
			),
		);

		expect(maximumActive).toBe(3);
	});

	test('drops queued requests from inactive channels without dropping the selected channel', async () => {
		const cache = new ReactionUserCache<Reactor>(10, 1, 1000);
		const active = deferred();
		const activeRequest = cache.load('old-channel:active-message', () => active.promise);

		await Promise.resolve();

		const staleLoad = mock(async () => [{ id: 'stale' }]);
		const staleRequest = cache.load('old-channel:queued-message', staleLoad);

		cache.cancelQueuedOutsideChannel('new-channel');

		const currentLoad = mock(async () => [{ id: 'current' }]);
		const currentRequest = cache.load('new-channel:visible-message', currentLoad);

		expect(await staleRequest).toEqual([]);
		expect(staleLoad).not.toHaveBeenCalled();

		active.resolve([{ id: 'active' }]);
		await activeRequest;

		expect(await currentRequest).toEqual([{ id: 'current' }]);
		expect(currentLoad).toHaveBeenCalledTimes(1);
	});

	test('retries empty reactor results after a short cache period', async () => {
		const cache = new ReactionUserCache<Reactor>(10, 1, 60_000, 50);
		const initialLoad = mock(async () => []);
		const retryLoad = mock(async () => [{ id: 'user' }]);

		await cache.load('reaction', initialLoad);
		await cache.load('reaction', retryLoad, Date.now() + 51);

		expect(initialLoad).toHaveBeenCalledTimes(1);
		expect(retryLoad).toHaveBeenCalledTimes(1);
		expect(cache.get('reaction')).toEqual([{ id: 'user' }]);
	});

	test('does not reuse a stale in-flight request after reaction changes', async () => {
		const cache = new ReactionUserCache<Reactor>();
		const old = deferred();
		const current = deferred();
		const oldRequest = cache.load('channel:message:emoji:0', () => old.promise);

		await Promise.resolve();
		cache.invalidate('channel:message:');

		const currentRequest = cache.load('channel:message:emoji:0', () => current.promise);

		await Promise.resolve();
		old.resolve([{ id: 'stale' }]);
		expect(await oldRequest).toEqual([]);
		expect(cache.get('channel:message:emoji:0')).toBeUndefined();

		current.resolve([{ id: 'current' }]);
		await currentRequest;
		expect(cache.get('channel:message:emoji:0')).toEqual([{ id: 'current' }]);
	});

	test('discards pending and completed data when cleared', async () => {
		const cache = new ReactionUserCache<Reactor>();
		const pending = deferred();
		const request = cache.load('first', () => pending.promise);

		await Promise.resolve();
		cache.clear();
		pending.resolve([{ id: 'user' }]);
		await request;

		expect(cache.get('first')).toBeUndefined();
	});
});
