import { pickDevice, type SpotifyClient } from '~/lib/spotify-api';

export type HostActivity = {
	sync_id?: string;
	timestamps?: { start?: number };
	party?: { id?: string };
};

export type FollowEvents = {
	onStopped(reason: 'premium' | 'no-device' | 'failed'): void;
};

export type FollowOptions = {
	client: SpotifyClient;
	openSpotify: () => void;
	wait: (ms: number) => Promise<void>;
	now?: () => number;
};

const SEEK_TOLERANCE_MS = 3_000;
const DEVICE_POLLS = 10;
const DEVICE_POLL_MS = 1_000;
const PREMIUM_REQUIRED = 403;

type Playing = { trackId: string; start: number } | undefined;

/**
 * @description Follows one person's Spotify activity: plays their track at their position, follows track changes and seeks,
 * and pauses while they are paused.
 * @param options The Spotify client, how to open the Spotify app and wait, and the clock.
 * @returns The follower.
 */
export function createFollower({ client, openSpotify, wait, now = Date.now }: FollowOptions) {
	let hostId: string | undefined;
	let deviceId: string | undefined;
	let playing: Playing;
	let paused = false;
	let events: FollowEvents | undefined;
	let queue = Promise.resolve();

	async function findDevice(): Promise<string | undefined> {
		const existing = pickDevice(await client.devices());

		if (existing) return existing.id;

		openSpotify();

		for (let attempt = 0; attempt < DEVICE_POLLS; attempt++) {
			await wait(DEVICE_POLL_MS);

			const device = pickDevice(await client.devices());

			if (device) return device.id;
		}

		return undefined;
	}

	function stop(reason?: 'premium' | 'no-device' | 'failed') {
		const listener = events;

		hostId = undefined;
		deviceId = undefined;
		playing = undefined;
		paused = false;
		events = undefined;

		if (reason) listener?.onStopped(reason);
	}

	async function apply(activity: HostActivity | undefined) {
		if (!hostId || !deviceId) return;

		if (!activity?.sync_id || !activity.timestamps?.start) {
			if (!paused && playing) {
				paused = true;
				await client.pause(deviceId);
			}

			return;
		}

		const start = activity.timestamps.start;
		const changed =
			paused ||
			playing?.trackId !== activity.sync_id ||
			Math.abs(playing.start - start) > SEEK_TOLERANCE_MS;

		if (!changed) return;

		const status = await client.play(deviceId, activity.sync_id, now() - start);

		if (status === PREMIUM_REQUIRED) return stop('premium');
		if (status >= 400) return stop('failed');

		playing = { trackId: activity.sync_id, start };
		paused = false;
	}

	function enqueue(work: () => Promise<void>) {
		queue = queue.then(work).catch(() => stop('failed'));

		return queue;
	}

	return {
		get following() {
			return hostId;
		},
		start(userId: string, activity: HostActivity, listener: FollowEvents) {
			stop();
			hostId = userId;
			events = listener;

			return enqueue(async () => {
				deviceId = await findDevice();

				if (!deviceId) return stop('no-device');

				await apply(activity);
			});
		},
		update(userId: string, activity: HostActivity | undefined) {
			if (userId !== hostId) return queue;

			return enqueue(() => apply(activity));
		},
		stop: () => stop(),
	};
}

export type Follower = ReturnType<typeof createFollower>;

export default { createFollower };
