export type PipClip = { kind: 'video'; uri: string; startAt: number } | { kind: 'web' };

export type PipClipStore = {
	current(): PipClip | null;
	show(clip: PipClip): void;
	hide(): number | undefined;
	recordTime(seconds: number): void;
	subscribe(listener: () => void): () => void;
};

/**
 * @description Creates the store of the video Android's picture in picture window plays, and how far it has got.
 * @returns The store.
 */
export function createPipClipStore(): PipClipStore {
	let clip: PipClip | null = null;
	let time: number | undefined;
	const listeners = new Set<() => void>();

	function notify() {
		for (const listener of listeners) listener();
	}

	return {
		current: () => clip,
		show(next) {
			clip = next;
			time = next.kind === 'video' ? next.startAt : undefined;
			notify();
		},
		hide() {
			const last = clip ? time : undefined;

			clip = null;
			time = undefined;
			notify();

			return last;
		},
		recordTime(seconds) {
			if (clip) time = seconds;
		},
		subscribe(listener) {
			listeners.add(listener);

			return () => listeners.delete(listener);
		},
	};
}
