import { describe, expect, mock, test } from 'bun:test';

const played: string[] = [];

void mock.module('@unbound-plugins/shared/media/sound-download', () => ({
	rememberSound: () => undefined,
}));

const { createSpeaker } = await import('~/lib/speaker');

describe('speaker', () => {
	test('skips messages that arrive while one is playing', async () => {
		let time = 0;
		const speaker = createSpeaker(
			{
				play: async (key: string) => (played.push(key), 1),
				stop: () => undefined,
				dispose: () => undefined,
			},
			() => time,
		);

		await speaker.speak('hello there', '1');
		time += 100;
		await speaker.speak('ignored', '2');
		time += 60_000;
		await speaker.speak('later', '3');

		expect(played).toHaveLength(2);
	});
});
