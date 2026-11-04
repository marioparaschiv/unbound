import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { flux, startPlugin } from '@unbound-app/api/testing';
import { settings } from '@unbound-app/settings';

const played: number[] = [];

const soundManager = {
	prepare: (
		_url: string,
		_category: string,
		_id: number,
		done: (error: null, meta: object) => void,
	) => done(null, { duration: 1 }),
	play: async (id: number) => void played.push(id),
	stop: () => {},
};

// The testing kit has no fake `native`, so the two files that touch it are replaced.
mock.module('~/moyai/platform', () => ({ msPerDurationUnit: 1000 }));
mock.module('~/moyai/modules', () => ({
	DCDSoundManager: soundManager,
	SelectedChannelStore: { getChannelId: () => 'selected' },
}));

beforeEach(async () => {
	played.length = 0;
	await startPlugin();
});

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
		await Bun.sleep(400);

		expect(played).toHaveLength(2);
	});

	test('stay silent in other channels', async () => {
		await message('other', '🗿');
		await Bun.sleep(20);

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
