import { reportDrawn } from '~/lib/self-test';

export function start() {
	patch();
}

const stop = () => unpatch();

export { stop, reportDrawn as selfTest };
