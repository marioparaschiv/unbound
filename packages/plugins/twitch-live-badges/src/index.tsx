import { watchTwitchEmbeds } from '~/flux/live-badges';

let stopWatching: (() => void) | undefined;

export function start() {
	stopWatching = watchTwitchEmbeds();
}

export function stop() {
	stopWatching?.();
	stopWatching = undefined;
}
