import { isVideoSource, mediaKey, sourceKeys } from '~/players/keys';
import { pickPlayer } from '~/players/pick';
import type { MediaSource, PlayerInfo, VideoInstance } from '~/types';

const MAX_PLAYERS = 32;

export type PlayerRegistry = {
	track(instance: VideoInstance): void;
	pick(source: MediaSource | undefined): VideoInstance | undefined;
	all(): VideoInstance[];
	version: () => number;
	changed(): void;
	subscribe: (listener: () => void) => () => void;
	clear: () => void;
};

function infoOf(instance: VideoInstance): PlayerInfo {
	const source = instance.props?.source;

	return {
		key: typeof source === 'object' ? mediaKey(source?.uri) : undefined,
		paused: instance.props?.paused === true,
	};
}

function isUnmounted(instance: VideoInstance): boolean {
	return instance._root === null;
}

/**
 * @description Creates the registry of `react-native-video` players Discord has rendered, so the media viewer's button can find the one showing its video.
 * @returns The registry.
 */
export function createPlayerRegistry(): PlayerRegistry {
	const players = new Map<VideoInstance, PlayerInfo>();
	const listeners = new Set<() => void>();
	let version = 0;
	let scheduled = false;

	function changed() {
		version += 1;

		if (scheduled) return;

		scheduled = true;
		setTimeout(() => {
			scheduled = false;

			for (const listener of listeners) listener();
		}, 0);
	}

	function prune() {
		for (const instance of players.keys()) {
			if (isUnmounted(instance)) players.delete(instance);
		}

		while (players.size > MAX_PLAYERS) {
			const [oldest] = players.keys();

			if (oldest) players.delete(oldest);
		}
	}

	return {
		track(instance) {
			const info = infoOf(instance);
			const previous = players.get(instance);

			if (previous && previous.key === info.key && previous.paused === info.paused) return;

			players.delete(instance);
			players.set(instance, info);
			prune();
			changed();
		},
		pick(source) {
			prune();

			return pickPlayer(players.entries(), sourceKeys(source), isVideoSource(source));
		},
		all: () => [...players.keys()],
		version: () => version,
		changed,
		subscribe(listener) {
			listeners.add(listener);

			return () => listeners.delete(listener);
		},
		clear() {
			players.clear();
			listeners.clear();
		},
	};
}
