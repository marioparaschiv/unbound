import { installAddonGlobals } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, mock, test } from 'bun:test';

type Interceptor = (action: object) => boolean | void;

const interceptors = new Map<string, Set<Interceptor>>();

function interceptAction(type: string, interceptor: Interceptor) {
	const set = interceptors.get(type) ?? new Set();

	set.add(interceptor);
	interceptors.set(type, set);

	return () => void set.delete(interceptor);
}

function dispatch(type: string, action: object): 'dropped' | 'passed' {
	for (const interceptor of interceptors.get(type) ?? []) {
		if (interceptor({ type, ...action }) === true) return 'dropped';
	}

	return 'passed';
}

const scope = installAddonGlobals({
	manifest: { id: 'unbound.super-reaction-tweaks' },
	unbound: { flux: { getStore: () => ({}), interceptAction } },
});

mock.module('@unbound-app/api', () => scope.unbound);

const { SETTINGS_BUCKET } = await import('~/modules');
const { CLEAR_ACTION, PLAY_ACTION, limitPlayingEffects } =
	await import('~/events/burst-reaction-effect');

const bucket = scope.storage.getBucket(SETTINGS_BUCKET);

const effect = (key: string, messageId = 'm1') => ({
	channelId: 'c1',
	messageId,
	emoji: { id: null, name: '🔥' },
	key,
});

function setLimit(limit: number) {
	bucket.set('superReactionPlayingLimit', limit);
}

beforeEach(() => {
	interceptors.clear();
	scope.logs.length = 0;
	setLimit(5);
});

describe('limitPlayingEffects', () => {
	test("passes every animation at Discord's own limit", () => {
		limitPlayingEffects();

		const results = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((key) =>
			dispatch(PLAY_ACTION, effect(key)),
		);

		expect(results.every((result) => result === 'passed')).toBe(true);
	});

	test('drops every animation at a limit of 0', () => {
		setLimit(0);
		limitPlayingEffects();

		expect(dispatch(PLAY_ACTION, effect('a'))).toBe('dropped');
	});

	test('drops animations past the limit on one message only', () => {
		setLimit(1);
		limitPlayingEffects();

		expect(dispatch(PLAY_ACTION, effect('a'))).toBe('passed');
		expect(dispatch(PLAY_ACTION, effect('b'))).toBe('dropped');
		expect(dispatch(PLAY_ACTION, effect('c', 'm2'))).toBe('passed');
	});

	test('frees a slot when the clear action arrives, and never drops clears', () => {
		setLimit(1);
		limitPlayingEffects();

		dispatch(PLAY_ACTION, effect('a'));

		expect(dispatch(CLEAR_ACTION, effect('a'))).toBe('passed');
		expect(dispatch(PLAY_ACTION, effect('b'))).toBe('passed');
	});

	test('counts animations it let through at the top limit once the limit is lowered', () => {
		limitPlayingEffects();
		dispatch(PLAY_ACTION, effect('a'));
		setLimit(1);

		expect(dispatch(PLAY_ACTION, effect('b'))).toBe('dropped');
	});

	test('passes everything again after stopping', () => {
		setLimit(0);
		limitPlayingEffects()();

		expect(dispatch(PLAY_ACTION, effect('a'))).toBe('passed');
		expect(interceptors.get(PLAY_ACTION)?.size).toBe(0);
		expect(interceptors.get(CLEAR_ACTION)?.size).toBe(0);
	});

	test('warns once when a play action lacks the ids it counts by', () => {
		limitPlayingEffects();
		dispatch(PLAY_ACTION, { emoji: { name: '🔥' } });
		dispatch(PLAY_ACTION, { emoji: { name: '🔥' } });

		expect(scope.logs.filter((entry) => entry.level === 'warn')).toHaveLength(1);
	});

	test('stays quiet for the expected shape', () => {
		limitPlayingEffects();
		dispatch(PLAY_ACTION, effect('a'));

		expect(scope.logs).toHaveLength(0);
	});
});
