import { patchLinkTaps } from '~/patches/link-taps';

export function start() {
	patchLinkTaps();
}

export function stop() {}
