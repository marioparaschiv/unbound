import { Sound } from '~/constants';

type SoundMetadata = { duration?: number };
type PrepareCallback = (error: unknown, metadata?: SoundMetadata) => void;

export type SoundManager = {
	prepare: (url: string, category: string, id: number, callback: PrepareCallback) => void;
	play: (id: number) => Promise<void>;
	stop: (id: number) => void;
};

export type Player = ReturnType<typeof createPlayer>;

/**
 * @description Prepares the Moyai sound with Discord's native sound manager and plays it on demand.
 * @param manager Discord's `DCDSoundManager` native module.
 * @returns `play` restarts the sound, `dispose` stops it and cancels pending work.
 */
export function createPlayer(manager: SoundManager) {
	let duration: number | null = null;
	let preparing = false;
	let disposed = false;
	let playing = false;
	let sequence = 0;
	let stopTimer: ReturnType<typeof setTimeout> | undefined;

	function prepare() {
		if (preparing || duration !== null) return;

		preparing = true;

		try {
			manager.prepare(Sound.url, 'media', Sound.id, (error, metadata) => {
				if (disposed) return;

				preparing = false;

				if (error) {
					console.error('[Moyai] Failed to prepare the sound:', error);

					return;
				}

				const seconds = metadata?.duration ?? 0;

				duration =
					Number.isFinite(seconds) && seconds > 0
						? seconds * 1000
						: Sound.fallbackDuration;
			});
		} catch (error) {
			preparing = false;
			console.error('[Moyai] Failed to prepare the sound:', error);
		}
	}

	async function play() {
		if (disposed) return;

		// The first match after a failed or pending preparation retries it instead of playing.
		if (duration === null) {
			prepare();

			return;
		}

		const current = ++sequence;

		clearTimeout(stopTimer);

		try {
			if (playing) manager.stop(Sound.id);

			playing = true;
			await manager.play(Sound.id);
		} catch (error) {
			if (current === sequence) playing = false;

			console.error('[Moyai] Failed to play the sound:', error);

			return;
		}

		if (disposed || current !== sequence) return;

		stopTimer = setTimeout(() => {
			playing = false;
			manager.stop(Sound.id);
		}, duration);
	}

	function dispose() {
		disposed = true;
		sequence++;
		clearTimeout(stopTimer);

		if (playing) manager.stop(Sound.id);

		playing = false;
	}

	prepare();

	return { play, dispose };
}
