import { describe, expect, test } from 'bun:test';

import { createFollower, type HostActivity } from '~/lib/follow';
import type { SpotifyClient, SpotifyDevice } from '~/lib/spotify-api';

const phone: SpotifyDevice = {
	id: 'phone',
	is_active: false,
	is_restricted: false,
	type: 'Smartphone',
};

function fakeClient(devices: SpotifyDevice[][], status = 204) {
	const calls: unknown[][] = [];
	const client: SpotifyClient = {
		devices: async () => devices.shift() ?? [],
		play: async (...args) => {
			calls.push(['play', ...args]);

			return status;
		},
		pause: async (...args) => {
			calls.push(['pause', ...args]);

			return 204;
		},
	};

	return { client, calls };
}

const listening = (trackId: string, start: number): HostActivity => ({
	sync_id: trackId,
	timestamps: { start },
	party: { id: 'spotify:42' },
});

function follower(devices: SpotifyDevice[][], status?: number) {
	const fake = fakeClient(devices, status);
	const opened: number[] = [];
	const stopped: string[] = [];
	const instance = createFollower({
		client: fake.client,
		openSpotify: () => opened.push(1),
		wait: async () => undefined,
		now: () => 100_000,
	});
	const events = { onStopped: (reason: string) => stopped.push(reason) };

	return { instance, events, calls: fake.calls, opened, stopped };
}

describe('listen along follower', () => {
	test("joins at the host's position on a device it finds", async () => {
		const { instance, events, calls } = follower([[phone]]);

		await instance.start('42', listening('track', 40_000), events);

		expect(calls).toEqual([['play', 'phone', 'track', 60_000]]);
		expect(instance.following).toBe('42');
	});

	test('opens Spotify and waits for a phone rather than playing on an idle speaker', async () => {
		const speaker: SpotifyDevice = {
			id: 'speaker',
			is_active: false,
			is_restricted: false,
			type: 'Speaker',
		};
		const { instance, events, calls, opened } = follower([
			[speaker],
			[speaker],
			[speaker, phone],
		]);

		await instance.start('42', listening('track', 40_000), events);

		expect(opened).toEqual([1]);
		expect(calls).toEqual([['play', 'phone', 'track', 60_000]]);
	});

	test('follows track changes and seeks, pauses and resumes, and ignores small drift', async () => {
		const { instance, events, calls } = follower([[phone]]);

		await instance.start('42', listening('one', 40_000), events);
		await instance.update('42', listening('one', 41_000));
		await instance.update('42', listening('two', 90_000));
		await instance.update('42', listening('two', 70_000));
		await instance.update('42', undefined);
		await instance.update('42', undefined);
		await instance.update('42', listening('two', 75_000));

		expect(calls.map((call) => call.slice(0, 3))).toEqual([
			['play', 'phone', 'one'],
			['play', 'phone', 'two'],
			['play', 'phone', 'two'],
			['pause', 'phone'],
			['play', 'phone', 'two'],
		]);
	});

	test('ignores other people and stops when asked', async () => {
		const { instance, events, calls } = follower([[phone]]);

		await instance.start('42', listening('one', 40_000), events);
		await instance.update('7', listening('two', 40_000));
		instance.stop();
		await instance.update('42', listening('two', 40_000));

		expect(calls).toHaveLength(1);
		expect(instance.following).toBeUndefined();
	});

	test('stops and says why when Spotify refuses or no device shows up', async () => {
		const premium = follower([[phone]], 403);

		await premium.instance.start('42', listening('one', 40_000), premium.events);

		expect(premium.stopped).toEqual(['premium']);
		expect(premium.instance.following).toBeUndefined();

		const missing = follower([]);

		await missing.instance.start('42', listening('one', 40_000), missing.events);

		expect(missing.stopped).toEqual(['no-device']);
	});
});
