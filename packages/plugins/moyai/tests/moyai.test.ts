import { afterEach, beforeEach, describe, expect, jest, test } from 'bun:test';
import { flux, native, startPlugin, stopPlugin } from '@unbound-app/api/testing';
import { settings } from '@unbound-app/settings';

import { Sound } from '~/constants';

const played: number[] = [];
const released: number[] = [];
const stopped: number[] = [];

const soundManager = {
	prepare: (
		_url: string,
		_category: string,
		_id: number,
		done: (error: null, meta: object) => void,
	) => done(null, { duration: 2 }),
	play: async (id: number) => void played.push(id),
	stop: (id: number) => void stopped.push(id),
	release: (id: number) => void released.push(id),
};

beforeEach(async () => {
	jest.useFakeTimers();
	played.length = 0;
	released.length = 0;
	stopped.length = 0;
	native.registerModule('DCDSoundManager', soundManager);
	flux.seed({ SelectedChannel: { getChannelId: () => 'selected' } });
	await startPlugin();
});

afterEach(() => jest.useRealTimers());

function message(channelId: string, content: string) {
	const action = { type: 'MESSAGE_CREATE', channelId, message: { content } };

	return flux.dispatch(action);
}

function react(name: string) {
	const action = {
		type: 'MESSAGE_REACTION_ADD',
		channelId: 'selected',
		messageId: 'm1',
		emoji: { name },
	};

	return flux.dispatch(action);
}

describe('messages', () => {
	test('play once per Moyai in the selected channel', async () => {
		await message('selected', '🗿 hello 🗿');
		jest.advanceTimersByTime(400);

		expect(played).toHaveLength(2);
	});

	test('stay silent in other channels', async () => {
		await message('other', '🗿');
		jest.advanceTimersByTime(400);

		expect(played).toHaveLength(0);
	});
});

describe('reactions', () => {
	test('play once per message and emoji', async () => {
		await react('🗿');
		await react('🗿');

		expect(played).toHaveLength(1);
	});

	test('stay silent when Play on reactions is off', async () => {
		settings.allowReactions = false;
		await react('🗿');

		expect(played).toHaveLength(0);
	});
});

async function playOnce() {
	await message('selected', '🗿');
	jest.advanceTimersByTime(0);
	// The play call awaits the native sound manager before it schedules the stop.
	for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('the length of the sound', () => {
	test('is read in seconds on iOS', async () => {
		await playOnce();
		jest.advanceTimersByTime(1_999);

		expect(stopped).toEqual([]);

		jest.advanceTimersByTime(1);

		expect(stopped).toEqual([Sound.id]);
	});
});

test('releases the sound when the plugin stops', async () => {
	await message('selected', '🗿');
	await stopPlugin();

	expect(released).toEqual([Sound.id]);
});

test('reports its feature applied to the self test', async () => {
	await stopPlugin();
	await startPlugin();

	// Imported here: loading the entry looks up DCDSoundManager, which beforeEach registers.
	const { selfTest } = await import('~/index');

	expect(selfTest()).toEqual({ ok: true, detail: '1 feature applied' });
});
