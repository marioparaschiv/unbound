import { flux, logs, metro, startPlugin, stopPlugin } from '@unbound-app/api/testing';
import { settings } from '@unbound-app/settings';
import { beforeEach, describe, expect, test } from 'bun:test';

type Row = {
	message: {
		channelId: string;
		attachments: { id: string; isSpoiler?: boolean }[];
		embeds: unknown[];
	};
};

const channels: Record<string, { nsfw?: boolean; parent_id?: string }> = {
	adult: { nsfw: true },
	thread: { parent_id: 'adult' },
	general: {},
};

class RowManager {
	generate(input: { message: { channel_id: string } }): Row {
		return {
			message: {
				channelId: input.message.channel_id,
				attachments: [{ id: 'a' }],
				embeds: [{ image: { url: 'x' } }, { title: 'text only' }],
			},
		};
	}
}

function generate(channelId: string) {
	return new RowManager().generate({ message: { channel_id: channelId } });
}

beforeEach(() => {
	flux.seed({ Channel: { getChannel: (id: string) => channels[id] } });
});

describe('starting', () => {
	test('blurs rows of a RowManager that loads after the plugin starts', async () => {
		await startPlugin();
		metro.register(RowManager);

		expect(generate('adult').message.attachments).toMatchObject([{ isSpoiler: true }]);
	});

	test('reports the row patch as applied', async () => {
		metro.register(RowManager);
		await startPlugin();

		expect(logs.entries.filter((entry) => entry.level === 'warn')).toEqual([]);
	});
});

describe('rows in channels', () => {
	beforeEach(async () => {
		metro.register(RowManager);
		await startPlugin();
	});

	test('blur attachments and embed media in an age-restricted channel', () => {
		const { message } = generate('adult');

		expect(message.attachments).toMatchObject([{ id: 'a', isSpoiler: true }]);
		expect(message.embeds).toMatchObject([{ spoiler: 'SPOILER' }, { title: 'text only' }]);
	});

	test('blur in a thread of an age-restricted channel', () => {
		expect(generate('thread').message.attachments).toMatchObject([{ isSpoiler: true }]);
	});

	test('stay as sent in other channels', () => {
		expect(generate('general').message.attachments).toEqual([{ id: 'a' }]);
	});

	test('skip a part the user turned off', () => {
		settings.embeds = false;

		const { message } = generate('adult');

		expect(message.attachments).toMatchObject([{ isSpoiler: true }]);
		expect(message.embeds).toEqual([{ image: { url: 'x' } }, { title: 'text only' }]);
	});

	test('are put back as Discord drew them when the plugin stops', async () => {
		const { message } = generate('adult');

		await stopPlugin();

		expect(message.attachments).toEqual([{ id: 'a' }]);
	});

	test('leave rows generated after the plugin stops as sent', async () => {
		await stopPlugin();

		expect(generate('adult').message.attachments).toEqual([{ id: 'a' }]);
	});
});
