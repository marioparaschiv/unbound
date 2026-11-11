import { reportDrawn } from '~/lib/self-test';

function start() {
	patch();
}

const stop = () => unpatch();

export default { start, stop, selfTest: reportDrawn };
