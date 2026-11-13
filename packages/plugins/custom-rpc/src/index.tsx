import { startPresence, stopPresence } from '~/lib/presence';

export function start() {
	startPresence();
}

export function stop() {
	stopPresence();
}
