import { listenToPolls } from '~/flux/listeners';

let stopListening: (() => void) | undefined;

export function start() {
	stopListening = listenToPolls();
}

export function stop() {
	stopListening?.();
	stopListening = undefined;
}
