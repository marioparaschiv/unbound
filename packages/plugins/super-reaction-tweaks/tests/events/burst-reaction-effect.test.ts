import { flux as fakeFlux, logs } from '@unbound-app/api/testing';
import { settings } from '@unbound-app/settings';
import { flux } from '@unbound-app/api';
import { describe, expect, test } from 'bun:test';

import { CLEAR_ACTION, PLAY_ACTION, limitPlayingEffects } from '~/events/burst-reaction-effect';

const effect = (key: string, messageId = 'm1') => ({
	channelId: 'c1',
	messageId,
	emoji: { id: null, name: '🔥' },
	key,
});

// An action reaches Discord's listeners only when no interceptor dropped it.
async function dispatch(type: string, action: object): Promise<'dropped' | 'passed'> {
	let passed = false;
	const remove = flux.onAction(type, () => void (passed = true));

	await fakeFlux.dispatch({ type, ...action });
	remove();

	return passed ? 'passed' : 'dropped';
}

describe('limitPlayingEffects', () => {
	test("passes every animation at Discord's own limit", async () => {
		limitPlayingEffects();

		const results = [];

		for (const key of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
			results.push(await dispatch(PLAY_ACTION, effect(key)));
		}

		expect(results.every((result) => result === 'passed')).toBe(true);
	});

	test('drops every animation at a limit of 0', async () => {
		settings.superReactionPlayingLimit = 0;
		limitPlayingEffects();

		expect(await dispatch(PLAY_ACTION, effect('a'))).toBe('dropped');
	});

	test('drops animations past the limit on one message only', async () => {
		settings.superReactionPlayingLimit = 1;
		limitPlayingEffects();

		expect(await dispatch(PLAY_ACTION, effect('a'))).toBe('passed');
		expect(await dispatch(PLAY_ACTION, effect('b'))).toBe('dropped');
		expect(await dispatch(PLAY_ACTION, effect('c', 'm2'))).toBe('passed');
	});

	test('frees a slot when the clear action arrives, and never drops clears', async () => {
		settings.superReactionPlayingLimit = 1;
		limitPlayingEffects();

		await dispatch(PLAY_ACTION, effect('a'));

		expect(await dispatch(CLEAR_ACTION, effect('a'))).toBe('passed');
		expect(await dispatch(PLAY_ACTION, effect('b'))).toBe('passed');
	});

	test('counts animations it let through at the top limit once the limit is lowered', async () => {
		limitPlayingEffects();
		await dispatch(PLAY_ACTION, effect('a'));
		settings.superReactionPlayingLimit = 1;

		expect(await dispatch(PLAY_ACTION, effect('b'))).toBe('dropped');
	});

	test('passes everything again after stopping', async () => {
		settings.superReactionPlayingLimit = 0;
		limitPlayingEffects()();

		expect(await dispatch(PLAY_ACTION, effect('a'))).toBe('passed');
	});

	test('warns once when a play action lacks the ids it counts by', async () => {
		limitPlayingEffects();
		await dispatch(PLAY_ACTION, { emoji: { name: '🔥' } });
		await dispatch(PLAY_ACTION, { emoji: { name: '🔥' } });

		expect(logs.entries.filter((entry) => entry.level === 'warn')).toHaveLength(1);
	});

	test('stays quiet for the expected shape', async () => {
		limitPlayingEffects();
		await dispatch(PLAY_ACTION, effect('a'));

		expect(logs.entries).toHaveLength(0);
	});
});
