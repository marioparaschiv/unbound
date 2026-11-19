import { badgeTwitchRows } from '~/patches/row-badges';

let stopBadges: (() => void) | undefined;

export function start() {
	stopBadges = badgeTwitchRows();
}

export function stop() {
	stopBadges?.();
	stopBadges = undefined;
}
